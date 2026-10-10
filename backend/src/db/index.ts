import { supabase, isSupabaseConfigured } from './supabase';
import { Session, Turn, ReportData } from '../lib/types';

// In-memory fallback stores for offline/local resilience
const inMemorySessions = new Map<string, Session>();
const inMemoryTurns = new Map<string, Turn[]>();
const inMemoryReports = new Map<string, ReportData>();

export async function createSessionDb(session: Session): Promise<Session> {
  // Always keep in local memory
  inMemorySessions.set(session.id, session);
  inMemoryTurns.set(session.id, []);

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('sessions').insert({
        id: session.id,
        topic: session.topic,
        topic_type: session.topicType,
        case_brief: session.caseBrief || null,
        language_mode: session.languageMode,
        panel_size: session.panelSize,
        persona_ids: session.personaIds,
        settings: session.settings,
        status: session.status,
        duration_sec: session.durationSec,
        created_at: session.createdAt
      });
      if (error) {
        console.warn('[Supabase] Failed to insert session, using local store:', error.message);
      }
    } catch (err: any) {
      console.warn('[Supabase] Exception inserting session:', err.message);
    }
  }

  return session;
}

export async function getSessionDb(id: string): Promise<Session | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          topic: data.topic,
          topicType: data.topic_type,
          caseBrief: data.case_brief,
          languageMode: data.language_mode,
          panelSize: data.panel_size,
          personaIds: data.persona_ids,
          settings: data.settings,
          status: data.status,
          durationSec: data.duration_sec,
          createdAt: data.created_at,
          endedAt: data.ended_at
        };
      }
    } catch (err: any) {
      console.warn('[Supabase] Failed to get session, falling back to local memory:', err.message);
    }
  }

  return inMemorySessions.get(id) || null;
}

export async function listSessionsDb(): Promise<Session[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          topic: d.topic,
          topicType: d.topic_type,
          caseBrief: d.case_brief,
          languageMode: d.language_mode,
          panelSize: d.panel_size,
          personaIds: d.persona_ids,
          settings: d.settings,
          status: d.status,
          durationSec: d.duration_sec,
          createdAt: d.created_at,
          endedAt: d.ended_at
        }));
      }
    } catch (err: any) {
      console.warn('[Supabase] Failed to list sessions, using local memory:', err.message);
    }
  }

  return Array.from(inMemorySessions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function updateSessionStatusDb(
  id: string,
  status: 'COMPLETED' | 'ABANDONED',
  durationSec: number
): Promise<void> {
  const local = inMemorySessions.get(id);
  if (local) {
    local.status = status;
    local.durationSec = durationSec;
    local.endedAt = new Date().toISOString();
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('sessions')
        .update({
          status,
          duration_sec: durationSec,
          ended_at: new Date().toISOString()
        })
        .eq('id', id);
    } catch (err: any) {
      console.warn('[Supabase] Update status failed:', err.message);
    }
  }
}

export async function addTurnDb(turn: Turn): Promise<void> {
  const turns = inMemoryTurns.get(turn.sessionId) || [];
  turns.push(turn);
  inMemoryTurns.set(turn.sessionId, turns);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('turns').insert({
        id: turn.id,
        session_id: turn.sessionId,
        idx: turn.idx,
        speaker_type: turn.speakerType,
        speaker_id: turn.speakerId || null,
        speaker_name: turn.speakerName,
        text: turn.text,
        start_ms: turn.startMs,
        end_ms: turn.endMs,
        duration_ms: turn.durationMs,
        was_barge_in: turn.wasBargeIn,
        was_interrupted: turn.wasInterrupted,
        mode: turn.mode,
        created_at: turn.createdAt || new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('[Supabase] Add turn failed:', err.message);
    }
  }
}

export async function getTurnsDb(sessionId: string): Promise<Turn[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('turns')
        .select('*')
        .eq('session_id', sessionId)
        .order('idx', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          sessionId: d.session_id,
          idx: d.idx,
          speakerType: d.speaker_type,
          speakerId: d.speaker_id,
          speakerName: d.speaker_name,
          text: d.text,
          startMs: d.start_ms,
          endMs: d.end_ms,
          durationMs: d.duration_ms,
          wasBargeIn: d.was_barge_in,
          wasInterrupted: d.was_interrupted,
          mode: d.mode,
          createdAt: d.created_at
        }));
      }
    } catch (err: any) {
      console.warn('[Supabase] Get turns failed:', err.message);
    }
  }

  return inMemoryTurns.get(sessionId) || [];
}

export async function saveReportDb(report: ReportData): Promise<void> {
  inMemoryReports.set(report.sessionId, report);

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('reports').upsert({
        id: report.id,
        session_id: report.sessionId,
        overall_score: report.overallScore,
        metrics: report.metrics,
        feedback: report.feedback,
        missed_openings: report.missedOpenings,
        summary: report.summary,
        created_at: report.createdAt
      });
    } catch (err: any) {
      console.warn('[Supabase] Save report failed:', err.message);
    }
  }
}

export async function getReportDb(sessionId: string): Promise<ReportData | null> {
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (!error && data) {
        return {
          id: data.id,
          sessionId: data.session_id,
          overallScore: data.overall_score,
          metrics: data.metrics,
          feedback: data.feedback,
          missedOpenings: data.missed_openings,
          summary: data.summary,
          createdAt: data.created_at
        };
      }
    } catch (err: any) {
      console.warn('[Supabase] Get report failed:', err.message);
    }
  }

  return inMemoryReports.get(sessionId) || null;
}
