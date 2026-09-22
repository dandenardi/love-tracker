-- Migration: password reset tokens. Stores a SHA-256 hash of a random reset token (never
-- the raw token) with a short expiry, mirroring the users.invite_code short-lived-code
-- pattern but as its own table since a reset request shouldn't clobber an in-flight
-- partner-pairing invite, and a reset event should be auditable/revocable independently.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  BIGINT NOT NULL,
  used_at     BIGINT,
  created_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
