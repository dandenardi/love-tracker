-- Migration: add locale to users, so push notifications can be composed in the
-- recipient's language instead of hardcoded English.
-- Idempotent: safe to run multiple times.

ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';
