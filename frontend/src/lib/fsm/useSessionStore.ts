import { create } from 'zustand';
import { Session, Turn, Phase, Persona, LanguageMode, TopicType, SessionSettings } from '../types';
import { PERSONAS, MODERATOR } from '../personas';
import { AudioPlaybackQueue } from '../voice/audioQueue';
import { BargeInDetector } from '../voice/bargeIn';
import { SpeechToTextEngine } from '../voice/stt';

interface SessionState {
  // Session details
  session: Session | null;
  phase: Phase;
  activePersonas: Persona[];
  transcript: Turn[];
  
  // Real-time conversation state
  currentSpeakerId: string | null;
  currentSpeakerName: string | null;
  isAiThinking: boolean;
  thinkingPersonaId: string | null;
  liveCaption: string;
  isStudentInterim: boolean;
  
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

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  phase: 'SETUP',
  activePersonas: [],
  transcript: [],
  
  currentSpeakerId: null,
  currentSpeakerName: null,
  isAiThinking: false,
  thinkingPersonaId: null,
  liveCaption: '',
  isStudentInterim: false,
  
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

    const durationSec = durationMinutes * 60;

    let sessionData: Session;
    let activePersonas: Persona[] = [];

    try {
      const res = await fetch('/api/sessions', {
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
            panelSize
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
        id: 'local_' + Math.random().toString(36).substring(2, 9),
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
          panelSize
        },
        status: 'IN_PROGRESS',
        durationSec: 0,
        createdAt: new Date().toISOString()
      };
      activePersonas = shuffled;
    }

    set({
      session: sessionData,
      phase: 'INTRO',
      activePersonas,
      transcript: [],
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

        // Setup Barge-In Detector
        bargeInDetector = new BargeInDetector({
          energyThreshold: 0.09,
          sustainedMs: 280,
          onBargeIn: () => {
            console.log('[BargeIn] Interruption detected from student mic!');
            audioQueue.stopImmediate(true);
            get().submitStudentTurn("Excuse me, I'd like to interject here...", true);
          }
        });

        // Setup STT Engine
        sttEngine = new SpeechToTextEngine(
          { patienceMs: state.session.settings.patienceMs, language: 'en-IN' },
          {
            onInterimResult: (interim) => {
              if (get().phase === 'DISCUSSION' || get().phase === 'CLOSING') {
                set({ liveCaption: interim, isStudentInterim: true, currentSpeakerId: 'student', currentSpeakerName: 'You (Student)' });
              }
            },
            onFinalResult: (finalText) => {
              if (get().phase === 'DISCUSSION' || get().phase === 'CLOSING') {
                set({ liveCaption: finalText, isStudentInterim: false });
              }
            },
            onSilenceTimeout: () => {
              const currentCap = get().liveCaption.trim();
              if (currentCap.length > 0 && (get().phase === 'DISCUSSION' || get().phase === 'CLOSING')) {
                get().submitStudentTurn(currentCap, false);
              }
            },
            onError: (err) => {
              console.warn('[STT Error]', err);
            }
          }
        );
      } catch (err: any) {
        console.warn('[Mic Init] Mic denied or unavailable:', err);
        set({ isTextMode: true, isMicActive: false });
      }
    }

    // 2. Start Global Clock Timer
    const timerId = setInterval(() => {
      const cur = get();
      if (cur.phase === 'REPORT') {
        clearInterval(timerId);
        return;
      }

      const nextRemaining = cur.timeRemainingSec - 1;
      const silentSecs = Math.floor((Date.now() - cur.lastStudentSpeakTime) / 1000);

      // Check silent nudge (default 90s)
      const nudgeLimit = cur.session?.settings.nudgeSecs || 90;
      if (cur.phase === 'DISCUSSION' && silentSecs >= nudgeLimit && silentSecs % nudgeLimit === 0) {
        const nextNudgeCount = cur.silentNudgeCount + 1;
        set({
          silentNudgeCount: nextNudgeCount,
          activeNudgeMessage: `You haven't spoken in ${silentSecs}s — jump in with your perspective!`
        });

        // If 2 nudges passed, trigger moderator prompt
        if (nextNudgeCount >= 2) {
          triggerNextTurnOrchestration();
        }
      }

      // Phase transitions
      if (nextRemaining === 90 && cur.phase === 'DISCUSSION') {
        set({ phase: 'TIME_WARNING', timeRemainingSec: nextRemaining });
        triggerNextTurnOrchestration();
      } else if (nextRemaining <= 0 && (cur.phase === 'DISCUSSION' || cur.phase === 'TIME_WARNING')) {
        set({ phase: 'CLOSING', timeRemainingSec: 0 });
        triggerNextTurnOrchestration();
      } else {
        set({ timeRemainingSec: Math.max(0, nextRemaining) });
      }
    }, 1000);

    set({ timerIntervalId: timerId });

    // 3. Play Moderator Opening Line (INTRO phase with spoken AI disclosure)
    triggerNextTurnOrchestration();
  },

  submitStudentTurn: async (text: string, wasBargeIn = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const state = get();
    if (!state.session) return;

    // Stop STT during turn processing
    sttEngine?.pause();

    const turnIdx = state.transcript.length + 1;
    const newTurn: Turn = {
      id: 'turn_student_' + Date.now(),
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

    const updatedTranscript = [...state.transcript, newTurn];
    set({
      transcript: updatedTranscript,
      liveCaption: trimmed,
      isStudentInterim: false,
      currentSpeakerId: 'student',
      currentSpeakerName: 'You (Student)',
      consecutiveAiTurns: 0,
      lastStudentSpeakTime: Date.now(),
      activeNudgeMessage: null
    });

    // Save turn to backend
    fetch(`/api/sessions/${state.session.id}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTurn)
    }).catch(err => console.warn('[Turn Save Error]', err));

    // Transition from INTRO to DISCUSSION if first turn
    if (state.phase === 'INTRO') {
      set({ phase: 'DISCUSSION' });
    }

    // Trigger AI response (Latency budget <= 3s)
    setTimeout(() => {
      triggerNextTurnOrchestration(wasBargeIn);
    }, 400);
  },

  endSession: async () => {
    const state = get();
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
    }

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
        await fetch(`/api/sessions/${state.session.id}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ durationSec, status: 'COMPLETED' })
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
      isAiThinking: false,
      thinkingPersonaId: null,
      liveCaption: '',
      isStudentInterim: false,
      activeNudgeMessage: null
    });
  }
}));

/**
 * Core turn-taking orchestrator coordinator
 */
async function triggerNextTurnOrchestration(wasStudentInterruption = false) {
  const store = useSessionStore.getState();
  if (!store.session || store.phase === 'REPORT') return;

  // Set thinking pulse state
  useSessionStore.setState({ isAiThinking: true });

  const payload = {
    sessionId: store.session.id,
    topic: store.session.topic,
    topicType: store.session.topicType,
    caseBrief: store.session.caseBrief,
    languageMode: store.session.languageMode,
    phase: store.phase,
    timeRemainingSec: store.timeRemainingSec,
    rollingTranscript: store.transcript.slice(-12),
    activePersonas: store.activePersonas,
    consecutiveAiTurns: store.consecutiveAiTurns,
    wasStudentInterruption,
    silentNudgeCount: store.silentNudgeCount
  };

  try {
    const res = await fetch('/api/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Orchestrator returned ' + res.status);
    const data = await res.json();

    const speakerId = data.speakerId || 'moderator';
    const persona = speakerId === 'moderator' 
      ? MODERATOR 
      : store.activePersonas.find(p => p.id === speakerId) || store.activePersonas[0];

    useSessionStore.setState({ 
      isAiThinking: false, 
      thinkingPersonaId: null,
      currentSpeakerId: persona.id,
      currentSpeakerName: persona.name,
      liveCaption: data.text,
      isStudentInterim: false
    });

    const turnIdx = store.transcript.length + 1;
    const aiTurn: Turn = {
      id: 'turn_ai_' + Date.now(),
      sessionId: store.session.id,
      idx: turnIdx,
      speakerType: speakerId === 'moderator' ? 'MODERATOR' : 'AI',
      speakerId: persona.id,
      speakerName: persona.name,
      text: data.text,
      startMs: Math.max(0, (store.totalDurationSec - store.timeRemainingSec) * 1000),
      endMs: Math.max(0, (store.totalDurationSec - store.timeRemainingSec + 4) * 1000),
      durationMs: 4000,
      wasBargeIn: false,
      wasInterrupted: false,
      mode: 'VOICE',
      createdAt: new Date().toISOString()
    };

    const newTranscript = [...store.transcript, aiTurn];
    const newAiTurns = speakerId === 'moderator' ? store.consecutiveAiTurns : store.consecutiveAiTurns + 1;

    useSessionStore.setState({
      transcript: newTranscript,
      consecutiveAiTurns: newAiTurns
    });

    // Save AI turn
    fetch(`/api/sessions/${store.session.id}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(aiTurn)
    }).catch(() => {});

    // Transition INTRO -> DISCUSSION
    if (store.phase === 'INTRO' && data.action !== 'END') {
      useSessionStore.setState({ phase: 'DISCUSSION' });
    }

    // Play speech through single-channel queue
    if (mediaStream) {
      bargeInDetector?.start(mediaStream);
    }

    audioQueue.enqueue({
      id: aiTurn.id,
      speakerId: persona.id,
      speakerName: persona.name,
      text: data.text,
      onStart: () => {
        useSessionStore.setState({
          currentSpeakerId: persona.id,
          currentSpeakerName: persona.name,
          liveCaption: data.text,
          isStudentInterim: false
        });
      },
      onEnd: () => {
        bargeInDetector?.stop();
        useSessionStore.setState({ currentSpeakerId: null, currentSpeakerName: null });

        // If in DISCUSSION and student has mic, resume STT listening
        if (!store.isTextMode) {
          sttEngine?.resume();
        }

        // If action was MOVE_TO_CLOSING or CLOSING, trigger closing flow
        if (data.action === 'MOVE_TO_CLOSING') {
          useSessionStore.setState({ phase: 'CLOSING' });
        } else if (data.action === 'END') {
          store.endSession();
        } else if (data.action === 'PARTICIPANT_TURN' && newAiTurns < 2 && Math.random() > 0.45) {
          // Rule: AI-to-AI interaction (never >2 consecutive AI turns without student)
          setTimeout(() => {
            triggerNextTurnOrchestration();
          }, 600);
        }
      },
      onInterrupted: () => {
        bargeInDetector?.stop();
        aiTurn.wasInterrupted = true;
      }
    });

  } catch (err: any) {
    console.warn('[Orchestrate Failed]', err);
    useSessionStore.setState({ isAiThinking: false });
  }
}
