import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('love_tracker.db');
  }
  return _db;
}

export async function initDatabase(): Promise<void> {
  const db = getDb();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      nickname TEXT,
      avatar_emoji TEXT DEFAULT '👤',
      color TEXT DEFAULT '#E85D75',
      is_partner INTEGER DEFAULT 0,
      partner_user_id TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      contact_id TEXT REFERENCES contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT,
      note TEXT,
      intensity INTEGER DEFAULT 0,
      mood_tag TEXT,
      occurred_at INTEGER NOT NULL,
      logged_at INTEGER NOT NULL,
      synced INTEGER DEFAULT 0,
      server_id TEXT
    );

    CREATE TABLE IF NOT EXISTS pitches (
      id TEXT PRIMARY KEY,
      event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
      from_partner_id TEXT,
      message TEXT,
      emoji TEXT,
      received_at INTEGER NOT NULL,
      read_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_events_contact ON events(contact_id);
    CREATE INDEX IF NOT EXISTS idx_events_occurred ON events(occurred_at);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
  `);

  // ── Safe migrations ──────────────────────────────────────────────────────
  // ALTER TABLE ADD COLUMN fails if the column already exists, so we wrap
  // each migration in a try/catch to make them idempotent.
  try {
    await db.execAsync(
      `ALTER TABLE events ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;`
    );
  } catch {
    // Column already exists — nothing to do.
  }
}
