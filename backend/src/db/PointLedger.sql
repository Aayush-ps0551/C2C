-- Supabase Migration for PointLedger (Section 4F)

CREATE TABLE IF NOT EXISTS "PointLedger" (
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

-- Index for fast lookup by sessionId
CREATE INDEX IF NOT EXISTS "idx_point_ledger_session" ON "PointLedger"("sessionId");
