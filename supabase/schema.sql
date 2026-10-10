-- ==============================================================================
-- GD Arena - Official Supabase PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  topic_type TEXT NOT NULL, -- CONTEMPORARY | ABSTRACT | CASE | CONTROVERSIAL | CUSTOM
  case_brief TEXT,
  language_mode TEXT NOT NULL DEFAULT 'EN', -- EN | HINGLISH
  panel_size INT NOT NULL DEFAULT 4,
  persona_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS | COMPLETED | ABANDONED
  duration_sec INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- 2. Create Turns Table
CREATE TABLE IF NOT EXISTS public.turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  idx INT NOT NULL,
  speaker_type TEXT NOT NULL, -- MODERATOR | AI | STUDENT
  speaker_id TEXT,
  speaker_name TEXT NOT NULL,
  text TEXT NOT NULL,
  start_ms INT NOT NULL DEFAULT 0,
  end_ms INT NOT NULL DEFAULT 0,
  duration_ms INT NOT NULL DEFAULT 0,
  was_barge_in BOOLEAN NOT NULL DEFAULT FALSE,
  was_interrupted BOOLEAN NOT NULL DEFAULT FALSE,
  mode TEXT NOT NULL DEFAULT 'VOICE', -- VOICE | TEXT
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
  overall_score INT NOT NULL, -- 0 - 100
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback JSONB NOT NULL DEFAULT '[]'::jsonb,
  missed_openings JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Fast Query Indexes
CREATE INDEX IF NOT EXISTS idx_turns_session_id ON public.turns(session_id);
CREATE INDEX IF NOT EXISTS idx_reports_session_id ON public.reports(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);

-- 5. Row Level Security (RLS) Policies for Public Anon API Access
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow public read/write turns" ON public.turns;
DROP POLICY IF EXISTS "Allow public read/write reports" ON public.reports;

CREATE POLICY "Allow public read/write sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write turns" ON public.turns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write reports" ON public.reports FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- Section 4F: Anti-Loop Engine PointLedger
-- ==============================================================================

-- 6. Create PointLedger Table
CREATE TABLE IF NOT EXISTS public."PointLedger" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" TEXT NOT NULL,
  "turnIdx" INTEGER NOT NULL,
  "speakerId" TEXT NOT NULL,
  "speakerName" TEXT NOT NULL,
  "claim" TEXT NOT NULL,
  "normText" TEXT NOT NULL,
  "embedding" JSONB NOT NULL,
  "move" TEXT NOT NULL,
  "targetId" TEXT,
  "repeatOfIdx" INTEGER,
  "repeatCount" INTEGER NOT NULL DEFAULT 1,
  "addressed" BOOLEAN NOT NULL DEFAULT false,
  "raiseCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Fast Query Indexes for PointLedger
CREATE INDEX IF NOT EXISTS "idx_point_ledger_session" ON public."PointLedger"("sessionId");

-- 8. Row Level Security (RLS) Policies for PointLedger
ALTER TABLE public."PointLedger" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read/write PointLedger" ON public."PointLedger";
CREATE POLICY "Allow public read/write PointLedger" ON public."PointLedger" FOR ALL USING (true) WITH CHECK (true);
