export type TopicType = 'CONTEMPORARY' | 'ABSTRACT' | 'CASE' | 'CONTROVERSIAL' | 'CUSTOM';
export type LanguageMode = 'EN' | 'HINGLISH';
export type Phase = 'SETUP' | 'INTRO' | 'OPENING_ROUND' | 'DEBATE' | 'DISCUSSION' | 'CONVERGENCE' | 'TIME_WARNING' | 'CLOSING' | 'REPORT';
export type SpeakerType = 'MODERATOR' | 'AI' | 'STUDENT';
export type InputMode = 'VOICE' | 'TEXT';
export type RoomIntensity = 'CAMPUS_MOCK' | 'REAL_GD' | 'PLACEMENT_BRUTAL';

export type OrchestratorAction = 
  | 'PARTICIPANT_TURN' 
  | 'MODERATOR_LINE' 
  | 'PROMPT_STUDENT' 
  | 'MOVE_TO_CLOSING' 
  | 'END';

export type IntentMove = 
  | 'AGREE' 
  | 'DISAGREE' 
  | 'BUILD' 
  | 'NEW_ANGLE' 
  | 'ASK_EVIDENCE' 
  | 'ASK_CLARIFY' 
  | 'INTERRUPT' 
  | 'RESUME' 
  | 'CONCEDE' 
  | 'YIELD' 
  | 'NONE';

export interface ParticipantIntent {
  wantsToSpeak: boolean;
  urgency: 1 | 2 | 3;
  move: IntentMove;
  target: string; // name or 'room'
  point: string;
  draftHook: string; // <= 15 words
  wouldInterrupt: boolean;
  stanceUpdate: string;
  notable?: boolean; // R3 Memory
  timestamp?: number;
}

export type ParticipantStatus = 'idle' | 'listening' | 'ready' | 'speaking';

export interface ArbiterResult {
  action: OrchestratorAction;
  winnerId?: string;
  winnerName?: string;
  winnerIntent?: ParticipantIntent;
  score?: number;
  isInterrupt?: boolean;
  reason: string;
}

export interface PersonaParams {
  talkativeness: number; // 0 to 1
  interruptLikelihood: number; // 0 to 1
  driftLikelihood: number; // 0 to 1
  buildOnOthersLikelihood: number; // 0 to 1
  stubbornness: number; // 0 to 1 (R2 Consequence)
  concession: number; // 0 to 1 (R2 Consequence)
}

export interface Persona {
  id: string;
  name: string;
  avatar: string;
  accentColor: string;
  role: string;
  tagline: string;
  systemPrompt: string;
  ttsVoiceId: string;
  ttsStyleHint: string;
  params: PersonaParams;
  fallbackLines: string[];
}

export interface SessionSettings {
  durationMinutes: number; // default 8
  patienceMs: number; // default 1500 (800-3000ms)
  nudgeSecs: number; // default 90
  languageMode: LanguageMode;
  panelSize: number; // 3 to 5
  intensity: RoomIntensity; // default 'REAL_GD'
  openingRoundEnabled: boolean; // default true
}

export interface Turn {
  id: string;
  sessionId: string;
  idx: number;
  speakerType: SpeakerType;
  speakerId?: string;
  speakerName: string;
  text: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  wasBargeIn: boolean;
  wasInterrupted: boolean;
  mode: InputMode;
  move?: IntentMove;
  targetId?: string;
  createdAt?: string;
}

export type SessionEventType = 
  | 'DUEL_DETECTED' 
  | 'CONCESSION' 
  | 'RE_RAISED_POINT' 
  | 'TALKED_OVER_STUDENT' 
  | 'INTERRUPTED_STUDENT' 
  | 'MISSED_OPENING'
  | 'SHAKE_UP'
  | 'POINT_DROPPED';

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: SessionEventType;
  atMs: number;
  meta: Record<string, any>;
  createdAt?: string;
}

export interface UnaddressedPoint {
  speakerId: string;
  speakerName: string;
  summary: string;
  turnIdx: number;
  addressed: boolean;
  raiseCount: number;
}

export interface NotableMoment {
  speakerId: string;
  speakerName: string;
  turnIdx: number;
  text: string;
  point: string;
}

export interface Session {
  id: string;
  topic: string;
  topicType: TopicType;
  caseBrief?: string;
  languageMode: LanguageMode;
  panelSize: number;
  personaIds: string[];
  settings: SessionSettings;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  durationSec: number;
  createdAt: string;
  endedAt?: string;
}

export interface OrchestrationResponse {
  action: OrchestratorAction;
  speakerId?: string;
  text: string;
  reason?: string;
  intent?: ParticipantIntent;
}

export interface FeedbackItem {
  category: 
    | 'STARTING' 
    | 'IDEA_QUALITY' 
    | 'BUILDING_ON_OTHERS' 
    | 'LISTENING' 
    | 'HANDLING_INTERRUPTIONS' 
    | 'ENDING_STRONGLY' 
    | 'USE_OF_EVIDENCE';
  kind: 'STRENGTH' | 'IMPROVE';
  quote: string;
  quoteTurnIdx: number;
  speakerName: string;
  timestamp: string;
  comment: string;
  suggestion: string;
}

export interface MissedOpening {
  turnIdx: number;
  context: string;
  whyItWasAnOpening: string;
  suggestedLine: string;
}

export interface ReportMetrics {
  speakTimeBySpeaker: Record<string, number>;
  turnCounts: Record<string, number>;
  interruptionsMade: number;
  interruptionsFaced: number;
  interruptionsWon: number;
  interruptionsLost: number;
  timesTalkedOver: number;
  pointsLeftHanging: number;
  concessionsForced: number;
  duelInvolvement: number;
  avgTurnLength: number;
  firstToSpeak: string;
  fillerWordCount: number;
  bestMoment?: NotableMoment;
}

export interface ReportSummary {
  score0to100: number;
  strengths: string[];
  focusAreas: string[];
}

export interface ReportData {
  id: string;
  sessionId: string;
  overallScore: number;
  metrics: ReportMetrics;
  feedback: FeedbackItem[];
  missedOpenings: MissedOpening[];
  events?: SessionEvent[];
  summary: ReportSummary;
  createdAt: string;
}
