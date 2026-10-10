-- GD Arena Supabase Schema
-- Run this in your Supabase SQL Editor

-- 1. Sessions table
CREATE TABLE IF NOT EXISTS sessions (
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

-- 2. Turns table
CREATE TABLE IF NOT EXISTS turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
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

-- 3. Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  overall_score INT NOT NULL, -- 0 - 100
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback JSONB NOT NULL DEFAULT '[]'::jsonb,
  missed_openings JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & add public policies for hackathon client access
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write turns" ON turns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write reports" ON reports FOR ALL USING (true) WITH CHECK (true);
