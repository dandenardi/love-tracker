import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './schema';
import { LoveEvent, EventTypeKey } from '@/types/shared';

export type { LoveEvent, EventTypeKey };

// ── CREATE ─────────────────────────────────────────────────────────────────
export async function createEvent(
  payload: Omit<LoveEvent, 'id' | 'logged_at' | 'synced'>
): Promise<LoveEvent> {
  const db = getDb();
  const event: LoveEvent = {
    ...payload,
    id: uuidv4(),
    logged_at: Date.now(),
    synced: 0,
    is_private: payload.is_private ?? 0,
  };
  await db.runAsync(
    `INSERT INTO events (id, contact_id, type, title, note, intensity, mood_tag, occurred_at, logged_at, synced, is_private)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.contact_id,
      event.type,
      event.title ?? null,
      event.note ?? null,
      event.intensity,
      event.mood_tag ?? null,
      event.occurred_at,
      event.logged_at,
      event.synced,
      event.is_private,
    ]
  );
  return event;
}

// ── UPSERT (for sync) ───────────────────────────────────────────────────────
export async function upsertEvent(event: LoveEvent): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO events (id, contact_id, type, title, note, intensity, mood_tag, occurred_at, logged_at, synced, is_private)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = EXCLUDED.type,
       title = EXCLUDED.title,
       note = EXCLUDED.note,
       intensity = EXCLUDED.intensity,
       mood_tag = EXCLUDED.mood_tag,
       occurred_at = EXCLUDED.occurred_at,
       logged_at = EXCLUDED.logged_at,
       synced = EXCLUDED.synced`,
    [
      event.id,
      event.contact_id,
      event.type,
      event.title ?? null,
      event.note ?? null,
      event.intensity,
      event.mood_tag ?? null,
      event.occurred_at,
      event.logged_at,
      event.synced,
      event.is_private,
    ]
  );
}

// ── READ ────────────────────────────────────────────────────────────────────
export function getEventsByContact(contactId: string): LoveEvent[] {
  const db = getDb();
  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id = ? ORDER BY occurred_at DESC`,
    [contactId]
  );
}

export async function getEventsByDate(contactId: string, dateMs: number): Promise<LoveEvent[]> {
  const db = getDb();
  // Match events that occurred on the same calendar day
  const startOfDay = new Date(dateMs);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateMs);
  endOfDay.setHours(23, 59, 59, 999);

  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ?
     ORDER BY occurred_at ASC`,
    [contactId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

export async function getEventsForMonth(
  contactId: string,
  year: number,
  month: number // 0-indexed
): Promise<LoveEvent[]> {
  const db = getDb();
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ?`,
    [contactId, start, end]
  );
}

export async function getAllEvents(contactId: string, limit = 100): Promise<LoveEvent[]> {
  const db = getDb();
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT ?`,
    [contactId, limit]
  );
}

// ── UPDATE ──────────────────────────────────────────────────────────────────
export async function updateEvent(id: string, patch: Partial<Omit<LoveEvent, 'id' | 'logged_at'>>): Promise<void> {
  const db = getDb();
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${String(f)} = ?`).join(', ');
  const values = fields.map((f) => patch[f] ?? null);
  await db.runAsync(`UPDATE events SET ${setClauses} WHERE id = ?`, [...values, id]);
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export async function deleteEvent(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM events WHERE id = ?`, [id]);
}

export async function markEventsAsSynced(contactId: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE events SET synced = 1 WHERE contact_id = ?`, [contactId]);
}

// ── PUBLIC HELPERS (Partner Sync safe — never includes private events) ───────
export async function getPublicEventsForMonth(
  contactId: string,
  year: number,
  month: number
): Promise<LoveEvent[]> {
  const db = getDb();
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ? AND is_private = 0`,
    [contactId, start, end]
  );
}

export async function getPublicEventsByDate(contactId: string, dateMs: number): Promise<LoveEvent[]> {
  const db = getDb();
  const startOfDay = new Date(dateMs);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateMs);
  endOfDay.setHours(23, 59, 59, 999);
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ? AND is_private = 0
     ORDER BY occurred_at ASC`,
    [contactId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

// ── STATS ───────────────────────────────────────────────────────────────────
export async function getEventCountByType(contactId: string): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db.getAllAsync<{ type: string; count: number }>(
    `SELECT type, COUNT(*) as count FROM events WHERE contact_id = ? GROUP BY type`,
    [contactId]
  );
  return Object.fromEntries(rows.map((r) => [r.type, r.count]));
}

export async function getDaysSinceLast(contactId: string, type: EventTypeKey): Promise<number | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{ occurred_at: number }>(
    `SELECT occurred_at FROM events WHERE contact_id = ? AND type = ? ORDER BY occurred_at DESC LIMIT 1`,
    [contactId, type]
  );
  if (!row) return null;
  return Math.floor((Date.now() - row.occurred_at) / 86400000);
}
