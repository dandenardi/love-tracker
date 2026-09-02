-- Migration: spec 007 — time-windowed AI Insights.
-- Shared daily throttle for period-scoped requests, which are never cached in ai_insights
-- and so have no cache row of their own to naturally rate-limit against.
-- Idempotent: safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_insight_last_generated_at BIGINT;
