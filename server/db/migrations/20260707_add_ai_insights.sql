-- Migration: Add AI Insights Engine (spec 002) — consent flag + cached insight storage
-- Date: 2026-07-07

-- 1. Consent flag on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_insights_opt_in BOOLEAN NOT NULL DEFAULT false;

-- 2. Cached insight per user per domain (upserted on refresh, at most 1/day)
CREATE TABLE IF NOT EXISTS ai_insights (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain             TEXT NOT NULL CHECK (domain IN ('solo', 'couple')),
  title              TEXT NOT NULL,
  body               TEXT NOT NULL,
  evidence_event_ids TEXT[] NOT NULL DEFAULT '{}',
  confidence         TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  generated_at       BIGINT NOT NULL,
  UNIQUE(user_id, domain)
);
