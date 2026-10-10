import { getSupabase } from './supabase';
import { Session, Turn, ReportData } from '../lib/types';
import { randomUUID } from 'crypto';

// In-memory fallback stores for offline/local resilience
const inMemorySessions = new Map<string, Session>();
const inMemoryTurns = new Map<string, Turn[]>();
const inMemoryReports = new Map<string, ReportData>();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function ensureUuid(id?: string): string {
  if (id && UUID_REGEX.test(id)) return id;
  return randomUUID();
}

export async function createSessionDb(session: Session): Promise<Session> {
  // Ensure valid UUID for Supabase PostgreSQL compatibility
  session.id = ensureUuid(session.id);

  // Keep in local memory
  inMemorySessions.set(session.id, session);
  inMemoryTurns.set(session.id, []);

  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client.from('sessions').insert({
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
      }).select();

      if (error) {
        console.error('[Supabase] Failed to insert session:', error.message, error.details);
      } else {
        console.log('[Supabase] Successfully saved session to database:', session.id);
      }
    } catch (err: any) {
      console.error('[Supabase] Exception inserting session:', err.message);
    }
  } else {
    console.warn('[Supabase] Client not configured. Using local memory store.');
  }

  return session;
}

export async function getSessionDb(id: string): Promise<Session | null> {
  const client = getSupabase();
  if (client && UUID_REGEX.test(id)) {
    try {
      const { data, error } = await client
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
      console.warn('[Supabase] Exception fetching session, falling back to local memory:', err.message);
    }
  }

  return inMemorySessions.get(id) || null;
}

export async function listSessionsDb(): Promise<Session[]> {
  const client = getSupabase();
  if (client) {
    try {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
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
      console.warn('[Supabase] Exception listing sessions:', err.message);
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

  const client = getSupabase();
  if (client && UUID_REGEX.test(id)) {
    try {
      const { error } = await client
        .from('sessions')
        .update({
          status,
          duration_sec: durationSec,
          ended_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('[Supabase] Failed to update session status:', error.message);
      } else {
        console.log('[Supabase] Session status updated:', id, status);
      }
    } catch (err: any) {
      console.error('[Supabase] Exception updating session status:', err.message);
    }
  }
}

export async function addTurnDb(turn: Turn): Promise<void> {
  turn.id = ensureUuid(turn.id);
  turn.sessionId = ensureUuid(turn.sessionId);

  const turns = inMemoryTurns.get(turn.sessionId) || [];
  turns.push(turn);
  inMemoryTurns.set(turn.sessionId, turns);

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('turns').insert({
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

      if (error) {
        console.error('[Supabase] Failed to insert turn:', error.message, error.details);
      } else {
        console.log('[Supabase] Successfully saved turn to database:', turn.id, turn.speakerName);
      }
    } catch (err: any) {
      console.error('[Supabase] Exception inserting turn:', err.message);
    }
  }
}

export async function getTurnsDb(sessionId: string): Promise<Turn[]> {
  const client = getSupabase();
  if (client && UUID_REGEX.test(sessionId)) {
    try {
      const { data, error } = await client
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
      console.warn('[Supabase] Exception fetching turns:', err.message);
    }
  }

  return inMemoryTurns.get(sessionId) || [];
}

export async function saveReportDb(report: ReportData): Promise<void> {
  report.id = ensureUuid(report.id);
  report.sessionId = ensureUuid(report.sessionId);

  inMemoryReports.set(report.sessionId, report);

  const client = getSupabase();
  if (client) {
    try {
      const { error } = await client.from('reports').upsert({
        id: report.id,
        session_id: report.sessionId,
        overall_score: report.overallScore,
        metrics: report.metrics,
        feedback: report.feedback,
        missed_openings: report.missedOpenings,
        summary: report.summary,
        created_at: report.createdAt
      });

      if (error) {
        console.error('[Supabase] Failed to save report:', error.message, error.details);
      } else {
        console.log('[Supabase] Successfully saved report to database for session:', report.sessionId);
      }
    } catch (err: any) {
      console.error('[Supabase] Exception saving report:', err.message);
    }
  }
}

export async function getReportDb(sessionId: string): Promise<ReportData | null> {
  const client = getSupabase();
  if (client && UUID_REGEX.test(sessionId)) {
    try {
      const { data, error } = await client
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
      console.warn('[Supabase] Exception fetching report:', err.message);
    }
  }

  return inMemoryReports.get(sessionId) || null;
}
