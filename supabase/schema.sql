-- ==============================================================================
-- GD Arena - Official Supabase PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID, -- References public.users(id) but kept loose for demo
  topic TEXT NOT NULL,
  topic_type TEXT NOT NULL, -- CONTEMPORARY | ABSTRACT | CASE | CONTROVERSIAL | CUSTOM
  case_brief TEXT,
  language_mode TEXT NOT NULL DEFAULT 'EN', -- EN | HINGLISH
  intensity TEXT NOT NULL DEFAULT 'REAL_GD', -- CAMPUS_MOCK | REAL_GD | PLACEMENT_BRUTAL
  opening_round_enabled BOOLEAN NOT NULL DEFAULT true,
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
-- ==============================================================================
-- GD Evaluation System
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.gd_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, 
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EVALUATOR', 'PARTICIPANT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gd_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  weightage INT NOT NULL CHECK (weightage >= 0 AND weightage <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gd_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id UUID, 
  name TEXT NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  persona_id TEXT, -- e.g., 'amelia', 'alex'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gd_evaluators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL, 
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gd_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.gd_participants(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL, 
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED')),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(participant_id, evaluator_id)
);

CREATE TABLE IF NOT EXISTS public.gd_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES public.gd_evaluations(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.gd_criteria(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(evaluation_id, criterion_id)
);

-- RLS
ALTER TABLE public.gd_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gd_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write gd_roles" ON public.gd_roles;
DROP POLICY IF EXISTS "Allow public read/write gd_criteria" ON public.gd_criteria;
DROP POLICY IF EXISTS "Allow public read/write gd_participants" ON public.gd_participants;
DROP POLICY IF EXISTS "Allow public read/write gd_evaluators" ON public.gd_evaluators;
DROP POLICY IF EXISTS "Allow public read/write gd_evaluations" ON public.gd_evaluations;
DROP POLICY IF EXISTS "Allow public read/write gd_scores" ON public.gd_scores;

CREATE POLICY "Allow public read/write gd_roles" ON public.gd_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write gd_criteria" ON public.gd_criteria FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write gd_participants" ON public.gd_participants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write gd_evaluators" ON public.gd_evaluators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write gd_evaluations" ON public.gd_evaluations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write gd_scores" ON public.gd_scores FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- User Profiles
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY, -- Will map to auth.users.id
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT, -- Optional since Supabase auth manages passwords
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  last_room TEXT, -- e.g. 'North Room' for map persistency
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read/write users" ON public.users;
CREATE POLICY "Allow public read/write users" ON public.users FOR ALL USING (true) WITH CHECK (true);

