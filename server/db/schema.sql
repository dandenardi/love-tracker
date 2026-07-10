CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  alias               TEXT NOT NULL,
  partner_id          UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_code         TEXT UNIQUE,
  invite_plain        TEXT,
  invite_expires      BIGINT,
  push_token          TEXT,
  ai_insights_opt_in  BOOLEAN NOT NULL DEFAULT false,
  premium_active      BOOLEAN NOT NULL DEFAULT false,
  premium_expires_at  BIGINT,
  created_at          BIGINT NOT NULL
);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  BIGINT NOT NULL,
  created_at  BIGINT NOT NULL
);

CREATE TABLE partnerships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_2   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  BIGINT NOT NULL,
  unpaired_at BIGINT,
  UNIQUE(user_id_1, user_id_2)
);

CREATE TABLE events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      TEXT NOT NULL,
  partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL,
  type           TEXT NOT NULL,
  title          TEXT,
  note           TEXT,
  intensity      INTEGER DEFAULT 0,
  mood_tag       TEXT,
  occurred_at    BIGINT NOT NULL,
  logged_at      BIGINT NOT NULL,
  deleted_at     BIGINT,
  is_private     INTEGER NOT NULL DEFAULT 0,
  created_at     BIGINT NOT NULL,
  contact_token  TEXT
);

CREATE TABLE pokes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL,
  message        TEXT NOT NULL,
  emoji          TEXT NOT NULL,
  sent_at        BIGINT NOT NULL,
  delivered_at   BIGINT,
  read_at        BIGINT
);

CREATE TABLE ai_insights (
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

CREATE UNIQUE INDEX idx_events_user_client ON events(user_id, client_id);
CREATE INDEX idx_events_user_occurred     ON events(user_id, occurred_at);
