import { create } from 'zustand';
import { 
  Session, 
  Turn, 
  Phase, 
  Persona, 
  TopicType, 
  SessionSettings, 
  ParticipantIntent, 
  ParticipantStatus, 
  ArbiterResult,
  RoomIntensity,
  UnaddressedPoint,
  NotableMoment,
  SessionEvent,
  SessionEventType
} from '../types';
import { PERSONAS, MODERATOR } from '../personas';
import { AudioPlaybackQueue } from '../voice/audioQueue';
import { BargeInDetector } from '../voice/bargeIn';
import { SpeechToTextEngine } from '../voice/stt';
import { emitBackchannel, playSoftChime } from '../voice/tts';
import { arbitrateTurn, INTENSITY_PRESETS } from './arbiter';
import { validateGrounding } from './grounding';
import { detectCycles } from './cycles';
import { apiUrl } from '../api';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function countWords(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

interface SessionState {
  // Session details
  session: Session | null;
  phase: Phase;
  activePersonas: Persona[];
  transcript: Turn[];
  
  // Real-time conversation state
  currentSpeakerId: string | null;
  currentSpeakerName: string | null;
  currentSpeakerType: 'MODERATOR' | 'AI' | 'STUDENT' | null;
  isAiThinking: boolean;
  thinkingPersonaId: string | null;
  liveCaption: string;
  isStudentInterim: boolean;

  // Active-Listening & Realism State (Sections 4B & 4C)
  intents: Record<string, ParticipantIntent | null>;
  stances: Record<string, string>;
  participantStatus: Record<string, ParticipantStatus>;
  flashingWinnerId: string | null;
  lastInterruptionTime: number;
  previousTurnIntents: Record<string, ParticipantIntent | null>;
  passResolutionLatencies: number[];

  // 4C Ledgers & Realism State
  unaddressedPoints: UnaddressedPoint[];
  notableMoments: NotableMoment[];
  sessionEvents: SessionEvent[];
  pressCounts: Record<string, number>;
  duelExchangeCount: number;
  activeDuelSpeakers: [string, string] | null;
  openingQueue: string[];
  openingQueueIndex: number;
  shakeUpCount: number;
  lastShakeUpTurn: number;
  sessionDigestAddendum?: string;
  noveltyFlags: Record<string, boolean>;
  
  // Timer state
  timeRemainingSec: number;
  totalDurationSec: number;
  timerIntervalId: any;
  
  // Turn counts & rules
  consecutiveAiTurns: number;
  silentSecondsCount: number;
  silentNudgeCount: number;
  lastStudentSpeakTime: number;
  activeNudgeMessage: string | null;
  
  // Voice & Input modes
  isMicActive: boolean;
  isMicMuted: boolean;
  isTextMode: boolean;
  isEchoCancellationEnabled: boolean;
  networkError: string | null;
  
  // Actions
  initializeSession: (topic: string, topicType: TopicType, caseBrief?: string, settings?: Partial<SessionSettings>) => Promise<Session>;
  startDiscussion: () => Promise<void>;
  submitStudentTurn: (text: string, wasBargeIn?: boolean) => Promise<void>;
  fireListenPasses: (triggerReason: string, studentInterimText?: string) => Promise<void>;
  runArbiterAndSpeak: (isSentenceInterruption?: boolean) => Promise<void>;
  logSessionEvent: (type: SessionEventType, meta: Record<string, any>) => void;
  setLiveCaption: (caption: string, isInterim: boolean) => void;
  toggleMicMute: () => void;
  enableTextMode: () => void;
  clearNudge: () => void;
  endSession: () => Promise<string | null>;
  resetStore: () => void;
}

const audioQueue = new AudioPlaybackQueue();
let bargeInDetector: BargeInDetector | null = null;
let sttEngine: SpeechToTextEngine | null = null;
let mediaStream: MediaStream | null = null;
let studentInterimDebounceTimeout: any = null;
let aiTurnTimeout: any = null;
let studentFloorTimer: any = null;
let openingSilenceTimer: any = null;
let studentSpeechStartTimestamp: number | null = null;
let lastDominatorTalkOverTime: number = 0;

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  phase: 'SETUP',
  activePersonas: [],
  transcript: [],
  
  currentSpeakerId: null,
  currentSpeakerName: null,
  currentSpeakerType: null,
  isAiThinking: false,
  thinkingPersonaId: null,
  liveCaption: '',
  isStudentInterim: false,

  intents: {},
  stances: {},
  participantStatus: {},
  flashingWinnerId: null,
  lastInterruptionTime: 0,
  previousTurnIntents: {},
  passResolutionLatencies: [],

  unaddressedPoints: [],
  notableMoments: [],
  sessionEvents: [],
  pressCounts: {},
  duelExchangeCount: 0,
  activeDuelSpeakers: null,
  openingQueue: [],
  openingQueueIndex: 0,
  shakeUpCount: 0,
  lastShakeUpTurn: 0,
  noveltyFlags: {},
  
  timeRemainingSec: 480, // 8 mins default
  totalDurationSec: 480,
  timerIntervalId: null,
  
  consecutiveAiTurns: 0,
  silentSecondsCount: 0,
  silentNudgeCount: 0,
  lastStudentSpeakTime: Date.now(),
  activeNudgeMessage: null,
  
  isMicActive: false,
  isMicMuted: false,
  isTextMode: false,
  isEchoCancellationEnabled: true,
  networkError: null,

  logSessionEvent: (type: SessionEventType, meta: Record<string, any>) => {
    const state = get();
    const event: SessionEvent = {
      id: generateUuid(),
      sessionId: state.session?.id || 'offline',
      type,
      atMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec) * 1000),
      meta,
      createdAt: new Date().toISOString()
    };
    console.log(`[SessionEvent] 📌 [${type}] @ ${Math.round(event.atMs / 1000)}s:`, meta);
    set({ sessionEvents: [...state.sessionEvents, event] });

    if (state.session?.id) {
      fetch(apiUrl(`/api/sessions/${state.session.id}/events`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(() => {});
    }
  },

  setLiveCaption: (caption: string, isInterim: boolean) => {
    set({ liveCaption: caption, isStudentInterim: isInterim });
  },

  clearNudge: () => {
    set({ activeNudgeMessage: null });
  },

  toggleMicMute: () => {
    const { isMicMuted } = get();
    const newMuted = !isMicMuted;
    set({ isMicMuted: newMuted });
    if (newMuted) {
      sttEngine?.pause();
    } else {
      sttEngine?.resume();
    }
  },

  enableTextMode: () => {
    set({ isTextMode: true, isMicActive: false });
    sttEngine?.stop();
    bargeInDetector?.stop();
  },

  initializeSession: async (topic, topicType, caseBrief, customSettings) => {
    const panelSize = customSettings?.panelSize || 4;
    const durationMinutes = customSettings?.durationMinutes || 8;
    const patienceMs = customSettings?.patienceMs || 1500;
    const nudgeSecs = customSettings?.nudgeSecs || 90;
    const languageMode = customSettings?.languageMode || 'EN';
    const intensity: RoomIntensity = customSettings?.intensity || 'REAL_GD';
    const openingRoundEnabled = customSettings?.openingRoundEnabled ?? true;

    const durationSec = durationMinutes * 60;

    let sessionData: Session;
    let activePersonas: Persona[] = [];

    try {
      const res = await fetch(apiUrl('/api/sessions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          topicType,
          caseBrief,
          languageMode,
          panelSize,
          settings: {
            durationMinutes,
            patienceMs,
            nudgeSecs,
            languageMode,
            panelSize,
            intensity,
            openingRoundEnabled
          }
        })
      });

      if (!res.ok) throw new Error('API failed to create session');
      const data = await res.json();
      sessionData = data.session;
      activePersonas = data.activePersonas;
    } catch (err: any) {
      console.warn('[SessionStore] API session create failed, using local offline session:', err.message);
      const shuffled = [...PERSONAS].sort(() => 0.5 - Math.random()).slice(0, panelSize);
      sessionData = {
        id: generateUuid(),
        topic,
        topicType,
        caseBrief,
        languageMode,
        panelSize,
        personaIds: shuffled.map(p => p.id),
        settings: {
          durationMinutes,
          patienceMs,
          nudgeSecs,
          languageMode,
          panelSize,
          intensity,
          openingRoundEnabled
        },
        status: 'IN_PROGRESS',
        durationSec: 0,
        createdAt: new Date().toISOString()
      };
      activePersonas = shuffled;
    }

    // Initialize per-participant initial stances and statuses
    const initialStances: Record<string, string> = {};
    const initialStatuses: Record<string, ParticipantStatus> = {
      moderator: 'idle',
      student: 'idle'
    };
    activePersonas.forEach(p => {
      initialStances[p.id] = `Observing discussion start on "${topic}".`;
      initialStatuses[p.id] = 'idle';
    });

    set({
      session: sessionData,
      phase: 'INTRO',
      activePersonas,
      transcript: [],
      intents: {},
      stances: initialStances,
      participantStatus: initialStatuses,
      flashingWinnerId: null,
      unaddressedPoints: [],
      notableMoments: [],
      sessionEvents: [],
      pressCounts: {},
      duelExchangeCount: 0,
      activeDuelSpeakers: null,
      openingQueue: [],
      openingQueueIndex: 0,
      shakeUpCount: 0,
      lastShakeUpTurn: 0,
      timeRemainingSec: durationSec,
      totalDurationSec: durationSec,
      consecutiveAiTurns: 0,
      silentSecondsCount: 0,
      silentNudgeCount: 0,
      lastStudentSpeakTime: Date.now()
    });

    return sessionData;
  },

  startDiscussion: async () => {
    const state = get();
    if (!state.session) return;

    const intensity = state.session.settings.intensity || 'REAL_GD';
    const config = INTENSITY_PRESETS[intensity] || INTENSITY_PRESETS.REAL_GD;

    // 1. Initialize Microphone & Barge-in Detector if not in Text Mode
    if (!state.isTextMode) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        set({ isMicActive: true });

        // R5: Barge-In Detector (≥300ms voice energy during AI playback)
        bargeInDetector = new BargeInDetector({
          energyThreshold: 0.09,
          sustainedMs: 300,
          onBargeIn: () => {
            const cur = get();
            const curSpeaker = cur.activePersonas.find(p => p.id === cur.currentSpeakerId);
            const now = Date.now();
            const isDominator = curSpeaker?.id === 'aarav';
            const canDominatorTalkOver = config.allowDominatorTalkOver && isDominator && (now - lastDominatorTalkOverTime > 120000);

            if (canDominatorTalkOver) {
              lastDominatorTalkOverTime = now;
              console.log('[BargeIn] 🚨 Dominator Aarav talking over student barge-in (+1 extra sentence, BRUTAL)!');
              cur.logSessionEvent('TALKED_OVER_STUDENT', {
                speakerId: curSpeaker.id,
                speakerName: curSpeaker.name,
                reason: 'Dominator talked over student barge-in (BRUTAL preset cap 1x/2min)'
              });
              // Talks over with 1 extra sentence then yields
              setTimeout(() => {
                audioQueue.cutAtNextSentenceBoundary(() => {
                  get().submitStudentTurn("Excuse me, I'd like to interject here...", true);
                });
              }, 1400);
            } else {
              console.log('[BargeIn] 🎙️ Student barge-in detected. AI finishes current sentence, then yields.');
              audioQueue.cutAtNextSentenceBoundary(() => {
                get().submitStudentTurn("Excuse me, I'd like to interject here...", true);
              });
            }
          }
        });

        // Setup STT Engine
        sttEngine = new SpeechToTextEngine(
          { patienceMs: state.session.settings.patienceMs, language: 'en-IN' },
          {
            onInterimResult: (interim) => {
              const cur = get();
              const curPhase = cur.phase;
              if (curPhase === 'DEBATE' || curPhase === 'CONVERGENCE' || curPhase === 'CLOSING' || curPhase === 'OPENING_ROUND' || curPhase === 'DISCUSSION' || curPhase === 'INTRO') {
                if (!studentSpeechStartTimestamp) {
                  studentSpeechStartTimestamp = Date.now();
                }

                set({ 
                  liveCaption: interim, 
                  isStudentInterim: true, 
                  currentSpeakerId: 'student', 
                  currentSpeakerName: 'You (Student)',
                  currentSpeakerType: 'STUDENT'
                });

                // Clear student floor timeout when student speaks
                clearTimeout(studentFloorTimer);
                clearTimeout(openingSilenceTimer);

                // R5: Check if student turn length exceeds ramble threshold in BRUTAL / REAL GD
                const elapsedSpeechSec = (Date.now() - studentSpeechStartTimestamp) / 1000;
                if (elapsedSpeechSec > config.aiInterruptStudentThresholdSec) {
                  console.log(`[R5 Ramble Interrupt] ⚡ Student spoke ${Math.round(elapsedSpeechSec)}s > threshold ${config.aiInterruptStudentThresholdSec}s. AI interjection allowed!`);
                  const interrupter = cur.activePersonas.find(p => p.id !== 'rohan') || cur.activePersonas[0];
                  cur.logSessionEvent('INTERRUPTED_STUDENT', {
                    speakerId: interrupter.id,
                    speakerName: interrupter.name,
                    elapsedSec: Math.round(elapsedSpeechSec),
                    reason: 'Student turn exceeded maximum ramble threshold'
                  });
                }

                // Trigger 2: Student STT has >= 8 words so far -> Debounced listen pass for all idle participants
                const words = countWords(interim);
                if (words >= 8) {
                  clearTimeout(studentInterimDebounceTimeout);
                  studentInterimDebounceTimeout = setTimeout(() => {
                    console.log(`[Stage A Trigger] 🎙️ Student reached ${words} words mid-speech. Firing debounced listen pass.`);
                    get().fireListenPasses('STUDENT_MID_SPEECH', interim);
                  }, 300);
                }
              }
            },
            onFinalResult: (finalText) => {
              const curPhase = get().phase;
              if (curPhase === 'DEBATE' || curPhase === 'CONVERGENCE' || curPhase === 'CLOSING' || curPhase === 'OPENING_ROUND' || curPhase === 'DISCUSSION' || curPhase === 'INTRO') {
                set({ liveCaption: finalText, isStudentInterim: false });
                if (countWords(finalText) >= 8) {
                  get().fireListenPasses('STUDENT_SENTENCE_FINAL', finalText);
                }
              }
            },
            onSilenceTimeout: () => {
              const currentCap = get().liveCaption.trim();
              if (currentCap.length > 0 && (get().phase === 'DEBATE' || get().phase === 'CONVERGENCE' || get().phase === 'CLOSING' || get().phase === 'OPENING_ROUND' || get().phase === 'DISCUSSION' || get().phase === 'INTRO')) {
                studentSpeechStartTimestamp = null;
                get().submitStudentTurn(currentCap, false);
              }
            },
            onError: (err) => {
              console.warn('[STT Error]', err);
            }
          }
        );

        sttEngine.start();
        set({ isMicActive: true, isMicMuted: false });
      } catch (err: any) {
        console.warn('[Mic Init] Mic denied or unavailable:', err);
        set({ isTextMode: true, isMicActive: false });
      }
    }

    // 2. Start Global Clock Timer (Enforcing R1 Discussion Arc)
    const timerId = setInterval(() => {
      const cur = get();
      if (cur.phase === 'REPORT') {
        clearInterval(timerId);
        return;
      }

      const nextRemaining = cur.timeRemainingSec - 1;
      const silentSecs = Math.floor((Date.now() - cur.lastStudentSpeakTime) / 1000);

      // Check silent nudge
      const nudgeLimit = cur.session?.settings.nudgeSecs || 90;
      if ((cur.phase === 'DEBATE' || cur.phase === 'DISCUSSION') && silentSecs >= nudgeLimit && silentSecs % nudgeLimit === 0) {
        const nextNudgeCount = cur.silentNudgeCount + 1;
        set({
          silentNudgeCount: nextNudgeCount,
          activeNudgeMessage: `You haven't spoken in ${silentSecs}s — jump in with your perspective!`
        });

        if (nextNudgeCount >= 2 && config === INTENSITY_PRESETS.CAMPUS_MOCK) {
          get().runArbiterAndSpeak();
        }
      }

      // R1: CONVERGENCE Phase Auto-Trigger at T-90s (Replaces plain TIME_WARNING)
      if (nextRemaining === 90 && (cur.phase === 'DEBATE' || cur.phase === 'DISCUSSION')) {
        console.log('[R1 Arc] 🎯 T-90s reached: transitioning to CONVERGENCE phase.');
        set({ phase: 'CONVERGENCE', timeRemainingSec: nextRemaining });
        get().runArbiterAndSpeak();
      } else if (nextRemaining <= 0 && (cur.phase === 'DEBATE' || cur.phase === 'CONVERGENCE' || cur.phase === 'DISCUSSION')) {
        console.log('[R1 Arc] 🏁 Time elapsed: transitioning to CLOSING phase.');
        set({ phase: 'CLOSING', timeRemainingSec: 0 });
        get().runArbiterAndSpeak();
      } else {
        set({ timeRemainingSec: Math.max(0, nextRemaining) });
      }
    }, 1000);

    set({ timerIntervalId: timerId });

    // 3. R1: Initialize Opening Round or Debate
    const openingRoundEnabled = state.session.settings.openingRoundEnabled ?? true;
    if (openingRoundEnabled) {
      // Build random order of participants for initial 15-25s stance, student included
      const participantQueue = [...state.activePersonas.map(p => p.id), 'student'].sort(() => 0.5 - Math.random());
      set({ openingQueue: participantQueue, openingQueueIndex: 0 });
    }

    // Play Moderator Intro
    get().runArbiterAndSpeak();
  },

  submitStudentTurn: async (text: string, wasBargeIn = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const state = get();
    if (!state.session) return;

    clearTimeout(studentFloorTimer);
    clearTimeout(openingSilenceTimer);
    studentSpeechStartTimestamp = null;
    sttEngine?.pause();

    const turnIdx = state.transcript.length + 1;
    const newTurn: Turn = {
      id: generateUuid(),
      sessionId: state.session.id,
      idx: turnIdx,
      speakerType: 'STUDENT',
      speakerId: 'student',
      speakerName: 'You (Student)',
      text: trimmed,
      startMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec) * 1000),
      endMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec + 3) * 1000),
      durationMs: 3000,
      wasBargeIn,
      wasInterrupted: false,
      mode: state.isTextMode ? 'TEXT' : 'VOICE',
      createdAt: new Date().toISOString()
    };

    // R2: Append student point to unaddressed points ledger
    const newPoint: UnaddressedPoint = {
      speakerId: 'student',
      speakerName: 'You (Student)',
      summary: trimmed.slice(0, 100),
      turnIdx,
      addressed: false,
      raiseCount: 1
    };

    const updatedTranscript = [...state.transcript, newTurn];
    set({
      transcript: updatedTranscript,
      unaddressedPoints: [...state.unaddressedPoints, newPoint],
      liveCaption: trimmed,
      isStudentInterim: false,
      currentSpeakerId: 'student',
      currentSpeakerName: 'You (Student)',
      currentSpeakerType: 'STUDENT',
      consecutiveAiTurns: 0,
      lastStudentSpeakTime: Date.now(),
      activeNudgeMessage: null
    });

    // Save turn to backend
    fetch(apiUrl(`/api/sessions/${state.session.id}/turns`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTurn)
    }).catch(err => console.warn('[Turn Save Error]', err));

    // Handle OPENING_ROUND step
    if (state.phase === 'OPENING_ROUND') {
      const nextIdx = state.openingQueueIndex + 1;
      set({ openingQueueIndex: nextIdx });
      if (nextIdx >= state.openingQueue.length) {
        // Opening round finished!
        set({ phase: 'DEBATE' });
      }
      setTimeout(() => get().runArbiterAndSpeak(), 500);
      return;
    }

    if (state.phase === 'INTRO') {
      set({ phase: state.session.settings.openingRoundEnabled ? 'OPENING_ROUND' : 'DEBATE' });
    }

    // Trigger 3: Student submits turn -> Listen pass for all idle participants
    console.log('[Stage A Trigger] 🧑‍🎓 Student turn submitted. Firing parallel listen passes...');
    await get().fireListenPasses('STUDENT_TURN_SUBMITTED');

    // Run Arbiter to select winner and speak
    setTimeout(() => {
      get().runArbiterAndSpeak();
    }, 150);
  },

  /**
   * STAGE A — LISTEN (parallel, per idle participant)
   * Injects R7 parameters (youWereJustInterrupted, yourUnaddressedPoints, pressCount, notableMoments, phase, intensity).
   */
  fireListenPasses: async (triggerReason: string, studentInterimText?: string) => {
    const state = get();
    if (!state.session || state.phase === 'REPORT') return;

    const idlePersonas = state.activePersonas.filter(
      p => p.id !== state.currentSpeakerId && p.id !== 'moderator'
    );

    if (idlePersonas.length === 0) return;

    // Set UI pulsing "listening" ring
    const newStatuses = { ...state.participantStatus };
    idlePersonas.forEach(p => {
      newStatuses[p.id] = 'listening';
    });
    set({ participantStatus: newStatuses });

    const lastTurn = state.transcript[state.transcript.length - 1];
    const intensity = state.session.settings.intensity || 'REAL_GD';
    const config = INTENSITY_PRESETS[intensity] || INTENSITY_PRESETS.REAL_GD;

    // Compute turns since spoke for each persona
    const turnsSinceSpokeMap: Record<string, number> = {};
    state.activePersonas.forEach(p => {
      let count = 0;
      for (let i = state.transcript.length - 1; i >= 0; i--) {
        if (state.transcript[i].speakerId === p.id) break;
        count++;
      }
      turnsSinceSpokeMap[p.id] = count;
    });

    const turnCounts: Record<string, number> = {};
    state.transcript.forEach(t => {
      turnCounts[t.speakerName] = (turnCounts[t.speakerName] || 0) + 1;
    });

    const recentTranscriptSummary = state.transcript.slice(-12).map(
      t => `${t.speakerName}: "${t.text}"`
    ).join('\n');

    // R3: Extract last 4 notable moments
    const notableSummary = state.notableMoments.slice(-4).map(
      m => `Turn ${m.turnIdx} (${m.speakerName}): "${m.text}"`
    ).join(' | ');

    // Fire parallel passes with Promise.allSettled and 2500ms AbortController
    const promises = idlePersonas.map(async (persona) => {
      const passStart = performance.now();
      const fireTimestamp = Date.now();

      // R2: Find unaddressed point for this persona that has been hanging >= config.unaddressedReRaiseTurns
      const personaUnaddressed = state.unaddressedPoints.find(
        pt => pt.speakerId === persona.id && !pt.addressed && (state.transcript.length - pt.turnIdx) >= config.unaddressedReRaiseTurns
      );
      const unaddressedInject = personaUnaddressed 
        ? `Your point from turn ${personaUnaddressed.turnIdx} — '${personaUnaddressed.summary}' — has not been addressed in ${state.transcript.length - personaUnaddressed.turnIdx} turns.`
        : undefined;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      try {
        const res = await fetch(apiUrl('/api/listen'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            sessionId: state.session!.id,
            personaId: persona.id,
            context: {
              phase: state.phase,
              timeRemainingSec: state.timeRemainingSec,
              lastSpeaker: lastTurn?.speakerName || 'Room',
              lastTurnText: lastTurn?.text || '',
              studentInterim: studentInterimText || '',
              verbatimWindow: recentTranscriptSummary,
              sessionDigest: `Topic: ${state.session!.topic}. Brief: ${state.session!.caseBrief || 'N/A'}`,
              turnsSinceSpoke: turnsSinceSpokeMap[persona.id] ?? 2,
              yourLastLine: state.transcript.slice().reverse().find(t => t.speakerId === persona.id)?.text || '',
              stance: state.stances[persona.id] || `Observing on "${state.session!.topic}"`,
              turnCounts,
              // R7 injections
              yourUnaddressedPoints: unaddressedInject,
              pressCount: state.pressCounts[persona.id] || 0,
              notableMoments: notableSummary,
              intensity
            }
          })
        });

        clearTimeout(timeoutId);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const intent: ParticipantIntent = await res.json();
        const latency = performance.now() - passStart;
        console.log(`[listen-pass-resolve] ✅ Pass resolved for ${persona.name} in ${Math.round(latency)}ms @ ${Date.now()}`);
        return { personaId: persona.id, intent, latency };

      } catch (err: any) {
        clearTimeout(timeoutId);
        console.warn(`[listen-pass-fail] ⚠️ Pass for ${persona.name} aborted/failed: ${err.message}`);
        return {
          personaId: persona.id,
          intent: null,
          latency: 2500
        };
      }
    });

    const results = await Promise.allSettled(promises);

    const updatedIntents = { ...state.intents };
    const updatedStances = { ...state.stances };
    const updatedStatus = { ...get().participantStatus };
    let updatedNotable = [...state.notableMoments];
    let updatedPoints = [...state.unaddressedPoints];
    const latencies: number[] = [];

    results.forEach(res => {
      if (res.status === 'fulfilled' && res.value) {
        const { personaId, intent, latency } = res.value;
        latencies.push(latency);
        if (intent) {
          updatedIntents[personaId] = intent;
          if (intent.stanceUpdate) {
            updatedStances[personaId] = intent.stanceUpdate;
          }
          // Bright pulse if urgency >= 2
          updatedStatus[personaId] = intent.urgency >= 2 ? 'ready' : 'idle';

          // R3: Add to notable moments if marked notable
          if (intent.notable) {
            const personaObj = state.activePersonas.find(p => p.id === personaId);
            updatedNotable.push({
              speakerId: personaId,
              speakerName: personaObj?.name || personaId,
              turnIdx: state.transcript.length,
              text: intent.draftHook || intent.point,
              point: intent.point
            });
            if (updatedNotable.length > 8) updatedNotable.shift();
          }

          // R2: Flip addressed flag if this intent references/builds on someone
          if (intent.target && intent.target !== 'room') {
            updatedPoints = updatedPoints.map(pt => {
              if (pt.speakerName.toLowerCase().includes(intent.target.toLowerCase()) || pt.speakerId === intent.target) {
                return { ...pt, addressed: true };
              }
              return pt;
            });
          }
        } else {
          updatedStatus[personaId] = 'idle';
        }
      }
    });

    set({
      intents: updatedIntents,
      stances: updatedStances,
      participantStatus: updatedStatus,
      notableMoments: updatedNotable,
      unaddressedPoints: updatedPoints,
      passResolutionLatencies: latencies
    });

    // Check sentence-boundary AI interruption:
    const currentState = get();
    if (
      currentState.currentSpeakerType === 'AI' && 
      currentState.currentSpeakerId !== 'moderator'
    ) {
      const now = Date.now();
      const canInterrupt = (now - currentState.lastInterruptionTime) >= config.aiInterruptAiCooldownMs;

      if (canInterrupt) {
        const candidateToInterrupt = Object.entries(updatedIntents).find(([pId, intent]) => 
          intent && intent.wouldInterrupt && intent.wantsToSpeak && pId !== currentState.currentSpeakerId
        );

        if (candidateToInterrupt) {
          const [interrupterId] = candidateToInterrupt;
          const interrupterPersona = currentState.activePersonas.find(p => p.id === interrupterId);
          console.log(`[Interrupt Trigger] ⚡ ${interrupterPersona?.name} desires to interrupt current AI line! Scheduling sentence-boundary cut.`);

          audioQueue.cutAtNextSentenceBoundary(() => {
            console.log(`[Interrupt Boundary Reached] ✂️ Audio cut at sentence boundary. Handing floor to ${interrupterPersona?.name}.`);
            get().runArbiterAndSpeak(true);
          });
        }
      }
    }
  },

  /**
   * STAGE B — ARBITRATE & STAGE C — SPEAK
   * Enforces R1 arc phases, R2 consequences, and R6 speak transitions.
   */
  runArbiterAndSpeak: async (isSentenceInterruption = false) => {
    const state = get();
    if (!state.session || state.phase === 'REPORT') return;

    clearTimeout(aiTurnTimeout);
    clearTimeout(studentFloorTimer);
    clearTimeout(openingSilenceTimer);

    const intensity = state.session.settings.intensity || 'REAL_GD';
    const config = INTENSITY_PRESETS[intensity] || INTENSITY_PRESETS.REAL_GD;

    // R1: OPENING ROUND sequential processing
    if (state.phase === 'OPENING_ROUND') {
      const queue = state.openingQueue;
      const qIdx = state.openingQueueIndex;

      if (qIdx < queue.length) {
        const nextParticipantId = queue[qIdx];
        if (nextParticipantId === 'student') {
          // Moderator calls student
          const modCallText = "I'd like to invite our student participant to present their opening stance. You have 15 to 20 seconds.";
          set({
            currentSpeakerId: 'moderator',
            currentSpeakerName: MODERATOR.name,
            currentSpeakerType: 'MODERATOR',
            liveCaption: modCallText
          });

          audioQueue.enqueue({
            id: generateUuid(),
            speakerId: 'moderator',
            speakerName: MODERATOR.name,
            text: modCallText,
            onEnd: () => {
              set({ currentSpeakerId: null, currentSpeakerName: null, currentSpeakerType: null });
              if (!get().isTextMode && !get().isMicMuted) sttEngine?.resume();

              // R1: If student silent for 5s when called -> moderator moves on and logs MISSED_OPENING
              console.log('[Opening Round] ⏱️ Waiting 5s for student opening...');
              openingSilenceTimer = setTimeout(() => {
                const cur = get();
                if (cur.phase === 'OPENING_ROUND' && !cur.currentSpeakerId) {
                  console.log('[Opening Round] ⚠️ Student silent for 5s. Logging MISSED_OPENING event and moving on.');
                  cur.logSessionEvent('MISSED_OPENING', {
                    turnIdx: cur.transcript.length + 1,
                    reason: 'Student silent 5s when called in opening round'
                  });

                  set({ openingQueueIndex: qIdx + 1 });
                  if (qIdx + 1 >= queue.length) {
                    set({ phase: 'DEBATE' });
                  }
                  get().runArbiterAndSpeak();
                }
              }, 5000);
            }
          });
          return;
        } else {
          // An AI participant's opening stance
          const persona = state.activePersonas.find(p => p.id === nextParticipantId);
          if (persona) {
            const promptText = `${persona.name}, please share your opening stance on this topic.`;
            set({
              currentSpeakerId: 'moderator',
              currentSpeakerName: MODERATOR.name,
              currentSpeakerType: 'MODERATOR',
              liveCaption: promptText
            });

            audioQueue.enqueue({
              id: generateUuid(),
              speakerId: 'moderator',
              speakerName: MODERATOR.name,
              text: promptText,
              onEnd: async () => {
                // Generate AI opening line
                const speakRes = await fetch(apiUrl('/api/speak'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    sessionId: state.session!.id,
                    personaId: persona.id,
                    intent: {
                      wantsToSpeak: true,
                      urgency: 2,
                      move: 'NEW_ANGLE',
                      target: 'room',
                      point: `Initial stance on ${state.session!.topic}`,
                      draftHook: 'To start off...',
                      wouldInterrupt: false,
                      stanceUpdate: `Initial position on ${state.session!.topic}`
                    },
                    context: {
                      rollingTranscriptShort: '',
                      languageMode: state.session!.languageMode,
                      topic: state.session!.topic,
                      topicType: state.session!.topicType,
                      caseBrief: state.session!.caseBrief,
                      isOpeningRound: true
                    }
                  })
                }).catch(() => null);

                const speakData = (speakRes && speakRes.ok) ? await speakRes.json() : null;
                const lineText = speakData?.text || '';

                if (!lineText) {
                  console.warn('[Opening Round] AI failed to generate opening line, skipping.');
                  set({ currentSpeakerId: null, currentSpeakerName: null, currentSpeakerType: null });
                  set({ openingQueueIndex: qIdx + 1 });
                  setTimeout(() => get().runArbiterAndSpeak(), 50);
                  return;
                }

                const turnIdx = get().transcript.length + 1;
                const aiTurn: Turn = {
                  id: generateUuid(),
                  sessionId: state.session!.id,
                  idx: turnIdx,
                  speakerType: 'AI',
                  speakerId: persona.id,
                  speakerName: persona.name,
                  text: lineText,
                  startMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec) * 1000),
                  endMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec + 4) * 1000),
                  durationMs: 4000,
                  wasBargeIn: false,
                  wasInterrupted: false,
                  mode: 'VOICE',
                  createdAt: new Date().toISOString()
                };

                set({ 
                  transcript: [...get().transcript, aiTurn],
                  openingQueueIndex: qIdx + 1
                });

                audioQueue.enqueue({
                  id: aiTurn.id,
                  speakerId: persona.id,
                  speakerName: persona.name,
                  text: lineText,
                  onStart: () => {
                    set({
                      currentSpeakerId: persona.id,
                      currentSpeakerName: persona.name,
                      currentSpeakerType: 'AI',
                      liveCaption: lineText
                    });
                  },
                  onEnd: () => {
                    set({ currentSpeakerId: null, currentSpeakerName: null, currentSpeakerType: null });
                    const nextQIdx = qIdx + 1;
                    if (nextQIdx >= queue.length) {
                      // Opening round finished!
                      console.log('[Opening Round] 🎉 Opening round complete! Moving to DEBATE.');
                      set({ phase: 'DEBATE' });
                    }
                    setTimeout(() => get().runArbiterAndSpeak(), 500);
                  }
                });
              }
            });
            return;
          }
        }
      } else {
        // Queue complete, transition to DEBATE
        set({ phase: 'DEBATE' });
      }
    }

    // Compute turns since spoke for each persona
    const turnsSinceSpokeMap: Record<string, number> = {};
    state.activePersonas.forEach(p => {
      let count = 0;
      for (let i = state.transcript.length - 1; i >= 0; i--) {
        if (state.transcript[i].speakerId === p.id) break;
        count++;
      }
      turnsSinceSpokeMap[p.id] = count;
    });

    const lastTurn = state.transcript[state.transcript.length - 1];

    let arbiterResult: ArbiterResult | null = null;
    
    // F4: Cycle Detection
    const cycles = detectCycles(state.transcript);
    if (cycles.isLooping && state.lastShakeUpTurn !== state.transcript.length) {
      const nextShakeUpCount = state.shakeUpCount + 1;
      set({ shakeUpCount: nextShakeUpCount, lastShakeUpTurn: state.transcript.length });
      
      if (nextShakeUpCount >= 2 && state.phase === 'DEBATE') {
        console.log('[F4 Escalation] ⚠️ 2 shake-ups within 8 turns. Forcing EARLY CONVERGENCE.');
        state.logSessionEvent('SHAKE_UP', { reason: 'Escalation to Early Convergence' });
        set({ phase: 'CONVERGENCE', shakeUpCount: 0 });
        // Let it fall through to moderator convergence line
      } else {
        state.logSessionEvent('SHAKE_UP', { reason: 'Cycle detected', claims: cycles.claims });
        // Force Moderator to speak a generated break-in
        arbiterResult = {
          action: 'MODERATOR_LINE',
          reason: 'F4 Shake-up required',
          isInterrupt: false
        };
        // Inject evidence into notable moments so moderator uses it
        const loopEvidence = `The exchange between ${cycles.speakers.join(' and ')} has circled twice. Repeated claims: '${cycles.claims[0]}'. Say one line that names the loop and forces a new direction.`;
        set({
          notableMoments: [...state.notableMoments, { speakerId: 'moderator', speakerName: MODERATOR.name, turnIdx: state.transcript.length, text: loopEvidence, point: 'Loop Break' }]
        });
      }
    }

    if (!arbiterResult) {
      // Run Stage B Arbiter
      arbiterResult = arbitrateTurn({
        intents: state.intents,
        activePersonas: state.activePersonas,
        consecutiveAiTurns: state.consecutiveAiTurns,
        phase: state.phase,
        timeRemainingSec: state.timeRemainingSec,
        currentSpeakerId: state.currentSpeakerId,
        currentSpeakerType: state.currentSpeakerType,
        turnsSinceSpokeMap,
        lastTurnText: lastTurn?.text || '',
        lastInterruptionTime: state.lastInterruptionTime,
        silentNudgeCount: state.silentNudgeCount,
        studentName: 'Student',
        intensity,
        duelExchangeCount: state.duelExchangeCount,
        activeDuelSpeakers: state.activeDuelSpeakers,
        passResolutionLatencies: state.passResolutionLatencies,
        transcript: state.transcript,
        noveltyFlags: state.noveltyFlags
      });
    }

    // 1. Moderator Line or Phase Transition
    if (arbiterResult.action === 'MODERATOR_LINE' || arbiterResult.action === 'MOVE_TO_CLOSING') {
      const isIntro = state.phase === 'INTRO' || state.transcript.length === 0;
      const isConvergence = state.phase === 'CONVERGENCE';
      const isClosing = state.phase === 'CLOSING' || arbiterResult.action === 'MOVE_TO_CLOSING';

      let moderatorText = '';
      if (isIntro) {
        moderatorText = `Welcome everyone to this Group Discussion on "${state.session.topic}". AI Disclosure: all fellow participants in this session are powered by AI models. ${state.session.settings.openingRoundEnabled ? "Let us begin with our opening stance round." : "The floor is open for debate. Who would like to start us off?"}`;
      } else if (isConvergence) {
        moderatorText = `Participants, we are entering our final 90 seconds. Let us work toward common ground and synthesize the core points of agreement across our perspectives.`;
      } else if (isClosing) {
        moderatorText = `Time is up. We are now in the closing round. Each participant will deliver one final takeaway line. Student, please deliver your concluding statement.`;
      } else {
        moderatorText = `Let us widen this discussion and make sure everyone has an opportunity to bring their perspectives to the floor.`;
      }

      set({
        currentSpeakerId: 'moderator',
        currentSpeakerName: MODERATOR.name,
        currentSpeakerType: 'MODERATOR',
        liveCaption: moderatorText,
        isStudentInterim: false
      });

      const turnIdx = state.transcript.length + 1;
      const modTurn: Turn = {
        id: generateUuid(),
        sessionId: state.session.id,
        idx: turnIdx,
        speakerType: 'MODERATOR',
        speakerId: 'moderator',
        speakerName: MODERATOR.name,
        text: moderatorText,
        startMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec) * 1000),
        endMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec + 4) * 1000),
        durationMs: 4000,
        wasBargeIn: false,
        wasInterrupted: false,
        mode: 'VOICE',
        createdAt: new Date().toISOString()
      };

      set({ transcript: [...state.transcript, modTurn] });
      fetch(apiUrl(`/api/sessions/${state.session.id}/turns`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modTurn)
      }).catch(() => {});

      if (isIntro) {
        set({ phase: state.session.settings.openingRoundEnabled ? 'OPENING_ROUND' : 'DEBATE' });
      }

      if (mediaStream) bargeInDetector?.start(mediaStream);

      audioQueue.enqueue({
        id: modTurn.id,
        speakerId: 'moderator',
        speakerName: MODERATOR.name,
        text: moderatorText,
        onStart: () => {
          set({
            currentSpeakerId: 'moderator',
            currentSpeakerName: MODERATOR.name,
            currentSpeakerType: 'MODERATOR',
            liveCaption: moderatorText
          });
        },
        onEnd: () => {
          bargeInDetector?.stop();
          set({ currentSpeakerId: null, currentSpeakerName: null, currentSpeakerType: null });
          if (!get().isTextMode && !get().isMicMuted) sttEngine?.resume();

          if (get().phase === 'OPENING_ROUND') {
            get().runArbiterAndSpeak();
          } else {
            console.log('[Stage A Trigger] 👩‍💼 Moderator finished line. Firing parallel listen passes...');
            get().fireListenPasses('MODERATOR_FINISHED');
          }
        }
      });
      return;
    }

    // 2. Prompt Student Action & R5 Floor Timeout
    if (arbiterResult.action === 'PROMPT_STUDENT') {
      const promptText = `I'd really like to bring in our student participant here. What is your perspective on this?`;
      
      set({
        currentSpeakerId: 'moderator',
        currentSpeakerName: MODERATOR.name,
        currentSpeakerType: 'MODERATOR',
        liveCaption: promptText,
        isStudentInterim: false
      });

      if (!state.isTextMode && !state.isMicMuted) {
        sttEngine?.resume();
      }

      // R5: Student Floor Timeout (12s Mock, 7s Real, 4s Brutal)
      console.log(`[R5 Floor Timeout] ⏱️ Started ${config.studentFloorTimeoutSec}s student floor timer.`);
      studentFloorTimer = setTimeout(() => {
        const cur = get();
        if (!cur.currentSpeakerId && !cur.isStudentInterim && (cur.phase === 'DEBATE' || cur.phase === 'DISCUSSION')) {
          console.log(`[R5 Floor Timeout Expired] ⏳ Student silent ${config.studentFloorTimeoutSec}s. Room moves on!`);
          set({ activeNudgeMessage: "Floor timeout expired — room moves on." });
          cur.runArbiterAndSpeak();
        }
      }, config.studentFloorTimeoutSec * 1000);

      return;
    }

    // 3. Stage C: Winner Speaks
    const winnerId = arbiterResult.winnerId;
    if (!winnerId) return;

    const winnerPersona = state.activePersonas.find(p => p.id === winnerId) || state.activePersonas[0];
    const winnerIntent = arbiterResult.winnerIntent || state.intents[winnerId] || {
      wantsToSpeak: true,
      urgency: 2,
      move: 'BUILD',
      target: 'room',
      point: 'Building on the core points discussed.',
      draftHook: 'To build on that...',
      wouldInterrupt: false,
      stanceUpdate: state.stances[winnerId] || 'Engaged'
    };

    // Flash winner in UI before their audio starts
    const updatedStatus = { ...state.participantStatus };
    updatedStatus[winnerId] = 'speaking';
    set({
      flashingWinnerId: winnerId,
      participantStatus: updatedStatus,
      isAiThinking: true,
      thinkingPersonaId: winnerId
    });

    // Check if this move is a concession
    const isConceding = winnerIntent.move === 'CONCEDE' || ((state.pressCounts[winnerId] || 0) >= 2 && Math.random() < winnerPersona.params.concession);
    if (isConceding) {
      state.logSessionEvent('CONCESSION', {
        speakerId: winnerPersona.id,
        speakerName: winnerPersona.name,
        forcedBy: lastTurn?.speakerName || 'Room',
        reason: 'Concession accepted under debate pressure'
      });
      set({ pressCounts: { ...state.pressCounts, [winnerId]: 0 } });
    }

    // Check if re-raising unaddressed point (F5)
    const unaddressedReRaise = state.unaddressedPoints.find(
      pt => pt.speakerId === winnerId && !pt.addressed && (state.transcript.length - pt.turnIdx) >= config.unaddressedReRaiseTurns
    );
    let unaddressedInjection = unaddressedReRaise?.summary;
    if (unaddressedReRaise) {
      const nextRaiseCount = (unaddressedReRaise.raiseCount || 1) + 1;
      const updatedPts = state.unaddressedPoints.map(p => 
         p.turnIdx === unaddressedReRaise.turnIdx ? { ...p, raiseCount: nextRaiseCount } : p
      );
      set({ unaddressedPoints: updatedPts });
      
      if (nextRaiseCount > 2) {
         unaddressedInjection = `you've raised this twice without an answer ('${unaddressedReRaise.summary}') — either concede it gracefully or drop it and move on`;
         state.logSessionEvent('POINT_DROPPED', { speakerId: winnerId, summary: unaddressedReRaise.summary });
      } else {
         state.logSessionEvent('RE_RAISED_POINT', {
           speakerId: winnerId,
           speakerName: winnerPersona.name,
           pointTurnIdx: unaddressedReRaise.turnIdx,
           summary: unaddressedReRaise.summary
         });
      }
    }

    // Section 4E G1: 12-turn verbatim window
    const verbatimWindow = state.transcript.slice(-12).map(
      t => `${t.speakerName}: "${t.text}"`
    ).join('\n');
    
    // G1: Session digest
    const sessionDigest = `Topic: ${state.session.topic}. Brief: ${state.session.caseBrief || 'N/A'}${state.sessionDigestAddendum || ''}`;

    try {
      let fullLineText = '';
      let noveltyEvidence = '';
      
      for (let attempt = 1; attempt <= 2; attempt++) {
        const speakRes = await fetch(apiUrl('/api/speak'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.session.id,
            personaId: winnerId,
            intent: winnerIntent,
            context: {
              verbatimWindow,
              sessionDigest,
              languageMode: state.session.languageMode,
              topic: state.session.topic,
              topicType: state.session.topicType,
              caseBrief: state.session.caseBrief,
              isInterrupt: arbiterResult.isInterrupt || isSentenceInterruption,
              // R6 injections
              move: winnerIntent.move,
              target: winnerIntent.target,
              unaddressedPoint: unaddressedInjection,
              pressCount: state.pressCounts[winnerId] || 0,
              notableMoments: [
                ...state.notableMoments.slice(-4).map(m => `Turn ${m.turnIdx} (${m.speakerName}): "${m.text}"`),
                noveltyEvidence ? `FEEDBACK: ${noveltyEvidence}` : ''
              ].filter(Boolean).join(' | ')
            }
          })
        });

        if (!speakRes.ok) throw new Error('Speak API returned ' + speakRes.status);
        const speakData = await speakRes.json();
        fullLineText = speakData.text;
        
        if (!fullLineText) {
          throw new Error('AI generated empty text (fallback to silence)');
        }

        // F3 Novelty Check via API
        try {
          const novRes = await fetch(apiUrl('/api/novelty-check'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: state.session.id, speakerId: winnerId, text: fullLineText })
          });
          
          if (novRes.ok) {
            const novData = await novRes.json();
            if (novData.isRepeat) {
              if (attempt === 1) {
                noveltyEvidence = novData.evidence;
                console.log(`[Novelty Gate] BLOCKED ${winnerPersona.name} - ${novData.type}`);
                continue; // retry
              } else {
                throw new Error(`Novelty check failed twice: ${novData.type}`);
              }
            }
            if (novData.isFlagged) {
              set({ noveltyFlags: { ...state.noveltyFlags, [winnerId]: true } });
              console.log(`[Novelty Gate] ⚠️ FLAGGED ${winnerPersona.name} for paraphrase threshold`);
            } else if (state.noveltyFlags[winnerId]) {
              const newFlags = { ...state.noveltyFlags };
              delete newFlags[winnerId];
              set({ noveltyFlags: newFlags });
            }
          } else {
            throw new Error('Novelty API failed');
          }
        } catch (novErr: any) {
          // F8 Degradation: Fallback to Zustand shingle check (G3)
          console.warn(`[Novelty Gate Fallback] DB read failed, using client shingle check`);
          const previousLines = state.transcript.slice(-12).map(t => t.text);
          const validation = validateGrounding(fullLineText, previousLines);
          if (!validation.isValid) {
            if (attempt === 1) {
              noveltyEvidence = validation.reason || 'Repeat detected.';
              continue; // retry
            } else {
              throw new Error(`Grounding validation failed twice: ${validation.reason}`);
            }
          }
        }
        
        break; // Passed
      }

      const turnIdx = state.transcript.length + 1;
      const aiTurn: Turn = {
        id: generateUuid(),
        sessionId: state.session.id,
        idx: turnIdx,
        speakerType: 'AI',
        speakerId: winnerPersona.id,
        speakerName: winnerPersona.name,
        text: fullLineText,
        startMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec) * 1000),
        endMs: Math.max(0, (state.totalDurationSec - state.timeRemainingSec + 4) * 1000),
        durationMs: 4000,
        wasBargeIn: false,
        wasInterrupted: false,
        mode: 'VOICE',
        move: winnerIntent.move,
        targetId: winnerIntent.target,
        createdAt: new Date().toISOString()
      };

      // R2: Append new AI point to unaddressed points ledger
      const newPoint: UnaddressedPoint = {
        speakerId: winnerPersona.id,
        speakerName: winnerPersona.name,
        summary: fullLineText.slice(0, 100),
        turnIdx,
        addressed: false,
        raiseCount: 1
      };

      // R2: Duel detection tracking
      let nextDuelExchanges = state.duelExchangeCount;
      let nextDuelSpeakers = state.activeDuelSpeakers;
      if (lastTurn && (winnerIntent.move === 'DISAGREE' || winnerIntent.move === 'INTERRUPT')) {
        const lastSpk = lastTurn.speakerId || lastTurn.speakerName;
        const curSpk = winnerPersona.id;
        if (nextDuelSpeakers && nextDuelSpeakers.includes(lastSpk) && nextDuelSpeakers.includes(curSpk)) {
          nextDuelExchanges++;
          if (nextDuelExchanges >= config.duelBrokenAfter) {
            state.logSessionEvent('DUEL_DETECTED', {
              speakers: [lastTurn.speakerName, winnerPersona.name],
              exchanges: nextDuelExchanges,
              reason: 'Consecutive disagreement exchanges threshold met'
            });
          }
        } else {
          nextDuelSpeakers = [lastSpk, curSpk];
          nextDuelExchanges = 1;
        }
      } else {
        nextDuelSpeakers = null;
        nextDuelExchanges = 0;
      }

      const newConsecutiveAiTurns = state.consecutiveAiTurns + 1;
      set({
        transcript: [...state.transcript, aiTurn],
        unaddressedPoints: [...state.unaddressedPoints, newPoint],
        consecutiveAiTurns: newConsecutiveAiTurns,
        isAiThinking: false,
        thinkingPersonaId: null,
        flashingWinnerId: null,
        duelExchangeCount: nextDuelExchanges,
        activeDuelSpeakers: nextDuelSpeakers,
        lastInterruptionTime: arbiterResult.isInterrupt ? Date.now() : state.lastInterruptionTime
      });

      // Save turn to backend
      fetch(apiUrl(`/api/sessions/${state.session.id}/turns`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiTurn)
      }).catch(() => {});

      // F1: Write to PointLedger
      fetch(apiUrl('/api/points'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.session.id,
          turnIdx,
          speakerId: winnerPersona.id,
          speakerName: winnerPersona.name,
          turnText: fullLineText,
          move: winnerIntent.move,
          targetId: winnerIntent.target
        })
      }).catch(err => console.warn('[PointLedger] Write failed:', err));

      // F6: Digest v2 every 6 turns
      if (turnIdx % 6 === 0) {
        fetch(apiUrl('/api/loop-analysis'), {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             sessionId: state.session.id,
             topic: state.session.topic,
             verbatimWindow: verbatimWindow
           })
        }).then(r => r.json()).then(data => {
           if (data.stagnant || data.unexplored?.length) {
              const addendum = data.stagnant ? ` This discussion has not moved in a while — prioritize a genuinely NEW angle (suggestions: ${(data.unexplored || []).join(', ')}).` : '';
              set({ sessionDigestAddendum: addendum });
           } else {
              set({ sessionDigestAddendum: '' });
           }
        }).catch(e => console.warn('Digest v2 failed:', e));
      }

      if (mediaStream) bargeInDetector?.start(mediaStream);

      // Play soft chime with stereo panning
      playSoftChime(winnerPersona.id);

      // Enqueue speech
      audioQueue.enqueue({
        id: aiTurn.id,
        speakerId: winnerPersona.id,
        speakerName: winnerPersona.name,
        text: fullLineText,
        onStart: () => {
          set({
            currentSpeakerId: winnerPersona.id,
            currentSpeakerName: winnerPersona.name,
            currentSpeakerType: 'AI',
            liveCaption: fullLineText,
            isStudentInterim: false
          });

          // R4: Backchannel reaction under AI line (at -18dB)
          const curState = get();
          if (curState.phase === 'DEBATE' && intensity !== 'CAMPUS_MOCK') {
            if (Math.random() < config.backchannelRate) {
              const idleWithUrgency = curState.activePersonas.filter(
                p => p.id !== winnerPersona.id && (curState.intents[p.id]?.urgency || 1) >= 2
              );
              if (idleWithUrgency.length > 0) {
                const backchanneler = idleWithUrgency[Math.floor(Math.random() * idleWithUrgency.length)];
                const bcMove = curState.intents[backchanneler.id]?.move || 'AGREE';
                setTimeout(() => {
                  emitBackchannel(backchanneler.id, bcMove);
                }, 800);
              }
            }
          }

          // Trigger 1: An AI line starts playing -> Listen pass for ALL other idle participants
          console.log(`[Stage A Trigger] 📢 ${winnerPersona.name} began speaking. Firing parallel listen passes for all idle participants.`);
          get().fireListenPasses('AI_SPEECH_STARTED');
        },
        onEnd: () => {
          bargeInDetector?.stop();
          const curStatus = { ...get().participantStatus };
          curStatus[winnerPersona.id] = 'idle';
          set({
            currentSpeakerId: null,
            currentSpeakerName: null,
            currentSpeakerType: null,
            participantStatus: curStatus
          });

          const currentStore = useSessionStore.getState();
          if (!currentStore.isTextMode && !currentStore.isMicMuted) {
            sttEngine?.resume();
          }

          // R5: If consecutive AI turns reaches 2, set floor timeout for student
          if (newConsecutiveAiTurns >= 2) {
            studentFloorTimer = setTimeout(() => {
              const cur = useSessionStore.getState();
              if (!cur.currentSpeakerId && !cur.isStudentInterim && (cur.phase === 'DEBATE' || cur.phase === 'DISCUSSION')) {
                console.log(`[R5 Student Floor Timeout] Room moves on after ${config.studentFloorTimeoutSec}s.`);
                set({ activeNudgeMessage: "Floor timeout expired — room moves on." });
                get().runArbiterAndSpeak();
              }
            }, config.studentFloorTimeoutSec * 1000);
          } else {
            // Conversational pause before next arbitrate turn
            aiTurnTimeout = setTimeout(() => {
              const cur = useSessionStore.getState();
              if (
                !cur.currentSpeakerId && 
                !cur.isStudentInterim && 
                (cur.phase === 'DEBATE' || cur.phase === 'CONVERGENCE' || cur.phase === 'DISCUSSION') && 
                cur.consecutiveAiTurns < 2
              ) {
                get().runArbiterAndSpeak();
              }
            }, 3500);
          }
        },
        onInterrupted: () => {
          bargeInDetector?.stop();
          aiTurn.wasInterrupted = true;
          console.log(`[Turn Interrupted] ✂️ Turn #${aiTurn.idx} (${winnerPersona.name}) was marked interrupted.`);

          // R2: Fight-back after interruption
          const persona = winnerPersona;
          const isStubborn = Math.random() < persona.params.stubbornness;
          console.log(`[Interruption Fight-Back] ${persona.name} (stubbornness ${persona.params.stubbornness}): ${isStubborn ? 'FIGHT BACK' : 'YIELD'}`);

          if (isStubborn) {
            fetch(apiUrl('/api/listen'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId: state.session!.id,
                personaId: persona.id,
                context: {
                  phase: get().phase,
                  timeRemainingSec: get().timeRemainingSec,
                  lastSpeaker: get().currentSpeakerName || 'Interrupter',
                  lastTurnText: get().liveCaption || '',
                  verbatimWindow,
                  sessionDigest,
                  turnsSinceSpoke: 0,
                  yourLastLine: aiTurn.text,
                  stance: get().stances[persona.id] || '',
                  turnCounts: {},
                  youWereJustInterrupted: true,
                  yourCutOffText: aiTurn.text.slice(-40)
                }
              })
            }).then(async r => {
              if (!r.ok) return;
              const fightIntent: ParticipantIntent = await r.json();
              console.log(`[Fight-Back Intent] ${persona.name} chose move: ${fightIntent.move}`);
              if (fightIntent.move === 'RESUME' || fightIntent.move === 'INTERRUPT') {
                const updatedIntents = { ...get().intents, [persona.id]: fightIntent };
                set({ intents: updatedIntents });
              }
            }).catch(() => {});
          }
        }
      });

    } catch (err: any) {
      console.warn('[Speak Generation Failed]', err);
      set({ isAiThinking: false, flashingWinnerId: null });
    }
  },

  endSession: async () => {
    const state = get();
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
    }
    clearTimeout(studentInterimDebounceTimeout);
    clearTimeout(aiTurnTimeout);
    clearTimeout(studentFloorTimer);
    clearTimeout(openingSilenceTimer);

    audioQueue.stopImmediate(false);
    bargeInDetector?.stop();
    sttEngine?.stop();

    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }

    const durationSec = state.totalDurationSec - state.timeRemainingSec;
    set({ phase: 'REPORT', isAiThinking: false });

    if (state.session) {
      try {
        await fetch(apiUrl(`/api/sessions/${state.session.id}/end`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationSec, status: 'COMPLETED' })
        });

        // Request report generation with sessionEvents & notableMoments
        await fetch(apiUrl('/api/report'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: state.session.id,
            transcript: state.transcript,
            durationSec,
            events: state.sessionEvents,
            notableMoments: state.notableMoments
          })
        });
      } catch (err) {
        console.warn('[End Session]', err);
      }
      return state.session.id;
    }
    return null;
  },

  resetStore: () => {
    const state = get();
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
    }
    clearTimeout(studentInterimDebounceTimeout);
    clearTimeout(aiTurnTimeout);
    clearTimeout(studentFloorTimer);
    clearTimeout(openingSilenceTimer);
    audioQueue.stopImmediate(false);
    bargeInDetector?.stop();
    sttEngine?.stop();
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
    }
    set({
      session: null,
      phase: 'SETUP',
      transcript: [],
      currentSpeakerId: null,
      currentSpeakerName: null,
      currentSpeakerType: null,
      isAiThinking: false,
      thinkingPersonaId: null,
      liveCaption: '',
      isStudentInterim: false,
      activeNudgeMessage: null,
      intents: {},
      stances: {},
      participantStatus: {},
      flashingWinnerId: null,
      unaddressedPoints: [],
      notableMoments: [],
      sessionEvents: [],
      pressCounts: {},
      duelExchangeCount: 0,
      activeDuelSpeakers: null,
      openingQueue: [],
      openingQueueIndex: 0,
      shakeUpCount: 0,
      lastShakeUpTurn: 0
    });
  }
}));
