CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  alias           TEXT NOT NULL,
  partner_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  invite_code     TEXT UNIQUE,
  invite_plain    TEXT,
  invite_expires  BIGINT,
  created_at      BIGINT NOT NULL
);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  BIGINT NOT NULL,
  created_at  BIGINT NOT NULL
);

CREATE TABLE events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     TEXT NOT NULL,
  type          TEXT NOT NULL,
  title         TEXT,
  note          TEXT,
  intensity     INTEGER DEFAULT 0,
  mood_tag      TEXT,
  occurred_at   BIGINT NOT NULL,
  logged_at     BIGINT NOT NULL,
  deleted_at    BIGINT,
  created_at    BIGINT NOT NULL
);

CREATE UNIQUE INDEX idx_events_user_client ON events(user_id, client_id);
CREATE INDEX idx_events_user_occurred     ON events(user_id, occurred_at);
