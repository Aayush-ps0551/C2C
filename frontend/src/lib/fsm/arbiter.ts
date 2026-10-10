import { Persona, ParticipantIntent, ArbiterResult, Phase, SpeakerType, RoomIntensity, Turn } from '../types';
import { MODERATOR } from '../personas';

export interface IntensityConfig {
  aiInterruptAiCooldownMs: number;
  aiInterruptStudentThresholdSec: number;
  backchannelRate: number;
  studentFloorTimeoutSec: number;
  duelBrokenAfter: number;
  unaddressedReRaiseTurns: number;
  allowDominatorTalkOver: boolean;
}

export const INTENSITY_PRESETS: Record<RoomIntensity, IntensityConfig> = {
  CAMPUS_MOCK: {
    aiInterruptAiCooldownMs: Infinity, // never
    aiInterruptStudentThresholdSec: Infinity, // never
    backchannelRate: 0.0, // off
    studentFloorTimeoutSec: 12,
    duelBrokenAfter: 2,
    unaddressedReRaiseTurns: 4,
    allowDominatorTalkOver: false
  },
  REAL_GD: {
    aiInterruptAiCooldownMs: 45000, // <= 1 per 45s
    aiInterruptStudentThresholdSec: 60, // only if student turn > 60s
    backchannelRate: 0.25, // ~25%
    studentFloorTimeoutSec: 7,
    duelBrokenAfter: 3,
    unaddressedReRaiseTurns: 3,
    allowDominatorTalkOver: false
  },
  PLACEMENT_BRUTAL: {
    aiInterruptAiCooldownMs: 20000, // <= 1 per 20s
    aiInterruptStudentThresholdSec: 30, // if student turn > 30s
    backchannelRate: 0.40, // ~40%
    studentFloorTimeoutSec: 4,
    duelBrokenAfter: 4,
    unaddressedReRaiseTurns: 2,
    allowDominatorTalkOver: true // Dominator may talk over student barge-in
  }
};

export interface ArbiterContext {
  intents: Record<string, ParticipantIntent | null>;
  activePersonas: Persona[];
  consecutiveAiTurns: number;
  phase: Phase;
  timeRemainingSec: number;
  currentSpeakerId: string | null;
  currentSpeakerType: SpeakerType | null;
  turnsSinceSpokeMap: Record<string, number>;
  lastTurnText: string;
  lastInterruptionTime: number;
  silentNudgeCount: number;
  studentName?: string;
  intensity?: RoomIntensity;
  duelExchangeCount?: number;
  activeDuelSpeakers?: [string, string] | null;
  passResolutionLatencies?: number[];
  transcript?: Turn[];
  noveltyFlags?: Record<string, boolean>;
}

/**
 * Stage B — ARBITER (Pure Client Code, < 50ms)
 * Deterministically evaluates intents, applies intensity preset dials (R0),
 * enforces arc phase gates (R1), and applies consequence rules (R2).
 */
export function arbitrateTurn(ctx: ArbiterContext): ArbiterResult {
  const t0 = performance.now();
  const now = Date.now();
  const {
    intents,
    activePersonas,
    consecutiveAiTurns,
    phase,
    timeRemainingSec,
    currentSpeakerId,
    currentSpeakerType,
    turnsSinceSpokeMap,
    lastTurnText,
    lastInterruptionTime,
    silentNudgeCount,
    studentName = 'Student',
    intensity = 'REAL_GD',
    duelExchangeCount = 0,
    activeDuelSpeakers = null,
    passResolutionLatencies = []
  } = ctx;

  const config = INTENSITY_PRESETS[intensity] || INTENSITY_PRESETS.REAL_GD;

  // 1. GATE: Phase checks
  if (phase === 'INTRO') {
    return {
      action: 'MODERATOR_LINE',
      winnerId: 'moderator',
      winnerName: MODERATOR.name,
      reason: 'Session opening intro belongs to the moderator'
    };
  }

  if (phase === 'CONVERGENCE' && timeRemainingSec <= 90 && timeRemainingSec > 60) {
    // Handled by moderator convergence bridge if not yet triggered
  }

  if (phase === 'CLOSING' || timeRemainingSec <= 0) {
    return {
      action: 'MOVE_TO_CLOSING',
      winnerId: 'moderator',
      winnerName: MODERATOR.name,
      reason: 'Closing round transition'
    };
  }

  // 2. GATE: Moderator holds floor while speaking
  if (currentSpeakerId === 'moderator' || currentSpeakerType === 'MODERATOR') {
    return {
      action: 'MODERATOR_LINE',
      winnerId: 'moderator',
      winnerName: MODERATOR.name,
      reason: 'Moderator holds floor'
    };
  }

  // 3. HARD GATE: Max 2 consecutive AI turns -> Force student prompt
  if (consecutiveAiTurns >= 2) {
    console.log('[Arbiter Gate] 🛑 2+ consecutive AI turns reached. Floor ceded to Student.');
    return {
      action: 'PROMPT_STUDENT',
      reason: 'Hard gate: Maximum 2 consecutive AI turns reached, student floor turn emitted'
    };
  }

  // 4. Escalation: Silent student past threshold
  if (silentNudgeCount >= 2) {
    return {
      action: 'PROMPT_STUDENT',
      reason: 'Student silent past threshold, moderator invitation'
    };
  }

  // 5. Duel Breakout Gate: If 2 participants traded DISAGREE/INTERRUPT >= K times
  const isDuelActive = duelExchangeCount >= config.duelBrokenAfter && activeDuelSpeakers !== null;

  // 6. Filter candidate intents
  interface Candidate {
    persona: Persona;
    intent: ParticipantIntent;
    score: number;
  }

  const candidates: Candidate[] = [];
  const textLower = (lastTurnText || '').toLowerCase();

  for (const persona of activePersonas) {
    if (persona.id === 'moderator') continue;
    if (persona.id === currentSpeakerId) continue;

    const intent = intents[persona.id];
    if (!intent) continue;

    // Drop intents with wantsToSpeak=false or move=NONE
    if (!intent.wantsToSpeak || intent.move === 'NONE') {
      continue;
    }

    const turnsSinceSpoke = turnsSinceSpokeMap[persona.id] ?? 2;

    // GATE: The Quiet One (Rohan) is excluded unless addressed, invited, or >= 4 turns silent
    if (persona.id === 'rohan') {
      const addressedByName = textLower.includes('rohan');
      const invitedByModerator = currentSpeakerId === 'moderator' && textLower.includes('rohan');
      const longSilence = turnsSinceSpoke >= 4;

      if (!addressedByName && !invitedByModerator && !longSilence) {
        continue;
      }
    }

    // Scoring Formula (Section 4B + 4C Realism modifiers):
    // urgency*3 + talkativeness + min(turnsSinceSpoke, 6) + (move==BUILD ? buildOnOthersLikelihood : 0) + (target==STUDENT_NAME ? 0.5 : 0) + random(0..1)
    let urgencyScore = intent.urgency * 3;
    const talkativenessScore = persona.params.talkativeness * 3;
    const turnsScore = Math.min(turnsSinceSpoke, 6);
    let buildScore = intent.move === 'BUILD' ? (persona.params.buildOnOthersLikelihood * 3) : 0;
    
    // R1 CONVERGENCE booster: boost AGREE or CONCEDE intents x1.5
    if (phase === 'CONVERGENCE' && (intent.move === 'AGREE' || intent.move === 'CONCEDE')) {
      urgencyScore *= 1.5;
      buildScore *= 1.5;
    }

    // R2 Duel detection booster: add +2 to third-party NEW_ANGLE intents
    let duelBooster = 0;
    if (isDuelActive && activeDuelSpeakers) {
      const isThirdParty = !activeDuelSpeakers.includes(persona.id);
      if (isThirdParty && (intent.move === 'NEW_ANGLE' || intent.move === 'BUILD')) {
        duelBooster = 2.0;
        console.log(`[Arbiter Duel Booster] 🥊 +2.0 boost to ${persona.name} (${intent.move}) to break duel.`);
      }
    }

    const targetStr = (intent.target || '').toLowerCase();
    const targetIsStudent = targetStr.includes('student') || targetStr.includes('you') || targetStr.includes(studentName.toLowerCase());
    const studentTargetScore = targetIsStudent ? 0.5 : 0;
    
    // F7 Arbiter Deltas
    let f7Delta = 0;
    const pastOwnTurns = (ctx.transcript || []).filter(t => t.speakerId === persona.id);
    
    // +1: NEW_ANGLE
    if (intent.move === 'NEW_ANGLE') f7Delta += 1;
    
    // +1: targeting someone they haven't targeted this session
    const pastTargets = pastOwnTurns.map(t => t.targetId || 'room');
    if (!pastTargets.includes(intent.target || 'room')) {
       f7Delta += 1;
    }
    
    // -2: last 2 moves identical AND last 2 targets identical
    if (pastOwnTurns.length >= 2) {
       const l1 = pastOwnTurns[pastOwnTurns.length - 1];
       const l2 = pastOwnTurns[pastOwnTurns.length - 2];
       if (l1.move === intent.move && l2.move === intent.move && (l1.targetId || 'room') === (intent.target || 'room') && (l2.targetId || 'room') === (intent.target || 'room')) {
          f7Delta -= 2;
       }
    }
    
    // -1.5: target would equal their target in 2 of their last 3 own turns
    if (pastOwnTurns.length >= 2) {
       const last3Targets = pastOwnTurns.slice(-3).map(t => t.targetId || 'room');
       const targetCount = last3Targets.filter(t => t === (intent.target || 'room')).length;
       if (targetCount >= 2) {
          f7Delta -= 1.5;
       }
    }
    
    // -1: novelty flag
    if (ctx.noveltyFlags && ctx.noveltyFlags[persona.id]) {
       f7Delta -= 1.0;
    }

    const jitter = Math.random();
    const totalScore = urgencyScore + talkativenessScore + turnsScore + buildScore + duelBooster + studentTargetScore + f7Delta + jitter;

    candidates.push({
      persona,
      intent,
      score: totalScore
    });
  }

  // 7. Zero valid intents -> Moderator bridge or PROMPT_STUDENT
  if (candidates.length === 0) {
    const fallbackAction = consecutiveAiTurns >= 1 ? 'PROMPT_STUDENT' : 'MODERATOR_LINE';
    return {
      action: fallbackAction,
      winnerId: fallbackAction === 'MODERATOR_LINE' ? 'moderator' : undefined,
      winnerName: fallbackAction === 'MODERATOR_LINE' ? MODERATOR.name : undefined,
      reason: 'Zero valid intents available from listening passes'
    };
  }

  // 8. Sort candidates by score descending
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  // 9. Interrupt path check (adhering to intensity config budget)
  let isInterrupt = false;
  const timeSinceLastInterrupt = now - lastInterruptionTime;
  const interruptBudgetAvailable = timeSinceLastInterrupt >= config.aiInterruptAiCooldownMs;

  if (
    winner.intent.wouldInterrupt && 
    currentSpeakerType === 'AI' && 
    currentSpeakerId !== 'moderator' && 
    interruptBudgetAvailable
  ) {
    isInterrupt = true;
    winner.intent.move = 'INTERRUPT';
    console.log(`[Arbiter Interrupt] ⚡ ${winner.persona.name} triggered an AI interruption (intensity: ${intensity}, cooldown: ${config.aiInterruptAiCooldownMs}ms).`);
  }

  const avgLatency = passResolutionLatencies.length > 0
    ? passResolutionLatencies.reduce((a, b) => a + b, 0) / passResolutionLatencies.length
    : 0;

  console.log(
    `[listen] ${activePersonas.length - 1} passes fired @${now}, resolved avg ${Math.round(avgLatency)}ms → winner: ${winner.persona.name} (score ${winner.score.toFixed(1)}, move=${winner.intent.move}, target=${winner.intent.target}) [arbitration took ${(performance.now() - t0).toFixed(2)}ms]`
  );

  return {
    action: 'PARTICIPANT_TURN',
    winnerId: winner.persona.id,
    winnerName: winner.persona.name,
    winnerIntent: winner.intent,
    score: winner.score,
    isInterrupt,
    reason: `Arbiter scored winner with ${winner.score.toFixed(1)} pts (move: ${winner.intent.move})`
  };
}
