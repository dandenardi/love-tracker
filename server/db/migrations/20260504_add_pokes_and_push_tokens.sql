-- Migration: add push_token to users + create pokes table
-- Idempotent: safe to run multiple times

-- Push token per user (Expo Push Token)
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Pokes table: quick messages sent between partners
CREATE TABLE IF NOT EXISTS pokes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL,
  message        TEXT NOT NULL,
  emoji          TEXT NOT NULL,
  sent_at        BIGINT NOT NULL,
  read_at        BIGINT
);

CREATE INDEX IF NOT EXISTS idx_pokes_recipient ON pokes(recipient_id, sent_at);
