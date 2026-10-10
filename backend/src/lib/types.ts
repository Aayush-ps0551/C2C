export type TopicType = 'CONTEMPORARY' | 'ABSTRACT' | 'CASE' | 'CONTROVERSIAL' | 'CUSTOM';
export type LanguageMode = 'EN' | 'HINGLISH';
export type Phase = 'SETUP' | 'INTRO' | 'DISCUSSION' | 'TIME_WARNING' | 'CLOSING' | 'REPORT';
export type SpeakerType = 'MODERATOR' | 'AI' | 'STUDENT';
export type InputMode = 'VOICE' | 'TEXT';

export type OrchestratorAction = 
  | 'PARTICIPANT_TURN' 
  | 'MODERATOR_LINE' 
  | 'PROMPT_STUDENT' 
  | 'MOVE_TO_CLOSING' 
  | 'END';

export interface PersonaParams {
  talkativeness: number; // 0 to 1
  interruptLikelihood: number; // 0 to 1
  driftLikelihood: number; // 0 to 1
  buildOnOthersLikelihood: number; // 0 to 1
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
  createdAt?: string;
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
  speakTimeBySpeaker: Record<string, number>; // speakerName -> seconds
  turnCounts: Record<string, number>; // speakerName -> turns
  interruptionsMade: number;
  interruptionsFaced: number;
  avgTurnLength: number; // words or seconds
  firstToSpeak: string;
  fillerWordCount: number;
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
  summary: ReportSummary;
  createdAt: string;
}
