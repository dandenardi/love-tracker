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
    `INSERT INTO events (id, contact_id, type, title, note, intensity, mood_tag, occurred_at, logged_at, synced, is_private, delivered_at, read_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.contact_id ?? null,
      event.type,
      event.title ?? null,
      event.note ?? null,
      event.intensity,
      event.mood_tag ?? null,
      event.occurred_at,
      event.logged_at,
      event.synced,
      event.is_private,
      event.delivered_at ?? null,
      event.read_at ?? null,
    ]
  );
  return event;
}

// ── UPSERT (for sync) ───────────────────────────────────────────────────────
export async function upsertEvent(event: LoveEvent): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO events (id, contact_id, type, title, note, intensity, mood_tag, occurred_at, logged_at, synced, is_private, delivered_at, read_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = EXCLUDED.type,
       title = EXCLUDED.title,
       note = EXCLUDED.note,
       intensity = EXCLUDED.intensity,
       mood_tag = EXCLUDED.mood_tag,
       occurred_at = EXCLUDED.occurred_at,
       logged_at = EXCLUDED.logged_at,
       synced = EXCLUDED.synced,
       delivered_at = EXCLUDED.delivered_at,
       read_at = EXCLUDED.read_at`,
    [
      event.id,
      event.contact_id ?? null,
      event.type,
      event.title ?? null,
      event.note ?? null,
      event.intensity,
      event.mood_tag ?? null,
      event.occurred_at,
      event.logged_at,
      event.synced,
      event.is_private ?? 0,
      event.delivered_at ?? null,
      event.read_at ?? null,
    ]
  );
}

// ── READ ────────────────────────────────────────────────────────────────────
// `contact_id IS ?` (rather than `=`) is NULL-safe: it matches unlinked solo
// events (contact_id IS NULL) when contactId is null, and behaves exactly
// like `=` for a real contact id otherwise. `deleted_at IS NULL` excludes
// soft-deleted tombstones pending push confirmation (see specs/005-deletion-sync).
export function getEventsByContact(contactId: string | null): LoveEvent[] {
  const db = getDb();
  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id IS ? AND deleted_at IS NULL ORDER BY occurred_at DESC`,
    [contactId]
  );
}

export async function getEventsByDate(contactId: string | null, dateMs: number): Promise<LoveEvent[]> {
  const db = getDb();
  // Match events that occurred on the same calendar day
  const startOfDay = new Date(dateMs);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateMs);
  endOfDay.setHours(23, 59, 59, 999);

  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id IS ? AND occurred_at >= ? AND occurred_at <= ? AND deleted_at IS NULL
     ORDER BY occurred_at ASC`,
    [contactId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

export async function getEventsForMonth(
  contactId: string | null,
  year: number,
  month: number // 0-indexed
): Promise<LoveEvent[]> {
  const db = getDb();
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id IS ? AND occurred_at >= ? AND occurred_at <= ? AND deleted_at IS NULL`,
    [contactId, start, end]
  );
}

export async function getAllEvents(contactId: string | null, limit = 100): Promise<LoveEvent[]> {
  const db = getDb();
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id IS ? AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT ?`,
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
// Soft-delete: tombstone locally until the server confirms the deletion, so an
// offline delete can be retried instead of being lost. See specs/005-deletion-sync.
export async function deleteEvent(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE events SET deleted_at = ? WHERE id = ?`, [Date.now(), id]);
}

// Hard-purges a tombstoned row. Call only after the server has confirmed the
// deletion, or when applying a deletion that originated remotely (nothing to confirm).
export async function purgeDeletedEvent(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM events WHERE id = ?`, [id]);
}

export async function getPendingDeletedIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM events WHERE deleted_at IS NOT NULL`
  );
  return rows.map((r) => r.id);
}

export async function markEventsAsSynced(contactId: string | null): Promise<void> {
  const db = getDb();
  await db.runAsync(`UPDATE events SET synced = 1 WHERE contact_id IS ?`, [contactId]);
}

// ── PUBLIC HELPERS (Partner Sync safe — never includes private events) ───────
export async function getPublicEventsForMonth(
  contactId: string | null,
  year: number,
  month: number
): Promise<LoveEvent[]> {
  const db = getDb();
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id IS ? AND occurred_at >= ? AND occurred_at <= ? AND is_private = 0 AND deleted_at IS NULL`,
    [contactId, start, end]
  );
}

export async function getPublicEventsByDate(contactId: string | null, dateMs: number): Promise<LoveEvent[]> {
  const db = getDb();
  const startOfDay = new Date(dateMs);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateMs);
  endOfDay.setHours(23, 59, 59, 999);
  return await db.getAllAsync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id IS ? AND occurred_at >= ? AND occurred_at <= ? AND is_private = 0 AND deleted_at IS NULL
     ORDER BY occurred_at ASC`,
    [contactId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

// ── STATS ───────────────────────────────────────────────────────────────────
export async function getEventCountByType(contactId: string | null): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db.getAllAsync<{ type: string; count: number }>(
    `SELECT type, COUNT(*) as count FROM events WHERE contact_id IS ? AND deleted_at IS NULL GROUP BY type`,
    [contactId]
  );
  return Object.fromEntries(rows.map((r) => [r.type, r.count]));
}

export async function getDaysSinceLast(contactId: string | null, type: EventTypeKey): Promise<number | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{ occurred_at: number }>(
    `SELECT occurred_at FROM events WHERE contact_id IS ? AND type = ? AND deleted_at IS NULL ORDER BY occurred_at DESC LIMIT 1`,
    [contactId, type]
  );
  if (!row) return null;
  return Math.floor((Date.now() - row.occurred_at) / 86400000);
}
