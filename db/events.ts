import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './schema';
import type { EventTypeKey } from '@/constants/eventTypes';

export interface LoveEvent {
  id: string;
  contact_id: string;
  type: EventTypeKey;
  title?: string;
  note?: string;
  intensity: number;
  mood_tag?: string;
  occurred_at: number; // unix ms
  logged_at: number;
  synced: number;
  server_id?: string;
  /** 1 = private (never synced to partner), 0 = shared */
  is_private: number;
}

// ── CREATE ─────────────────────────────────────────────────────────────────
export function createEvent(
  payload: Omit<LoveEvent, 'id' | 'logged_at' | 'synced'>
): LoveEvent {
  const db = getDb();
  const event: LoveEvent = {
    ...payload,
    id: uuidv4(),
    logged_at: Date.now(),
    synced: 0,
    is_private: payload.is_private ?? 0,
  };
  db.runSync(
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

// ── READ ────────────────────────────────────────────────────────────────────
export function getEventsByContact(contactId: string): LoveEvent[] {
  const db = getDb();
  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id = ? ORDER BY occurred_at DESC`,
    [contactId]
  );
}

export function getEventsByDate(contactId: string, dateMs: number): LoveEvent[] {
  const db = getDb();
  // Match events that occurred on the same calendar day
  const startOfDay = new Date(dateMs);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateMs);
  endOfDay.setHours(23, 59, 59, 999);

  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ?
     ORDER BY occurred_at ASC`,
    [contactId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

export function getEventsForMonth(
  contactId: string,
  year: number,
  month: number // 0-indexed
): LoveEvent[] {
  const db = getDb();
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ?`,
    [contactId, start, end]
  );
}

export function getAllEvents(contactId: string, limit = 100): LoveEvent[] {
  const db = getDb();
  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT ?`,
    [contactId, limit]
  );
}

// ── UPDATE ──────────────────────────────────────────────────────────────────
export function updateEvent(id: string, patch: Partial<Omit<LoveEvent, 'id' | 'logged_at'>>): void {
  const db = getDb();
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f] ?? null);
  db.runSync(`UPDATE events SET ${setClauses} WHERE id = ?`, [...values, id]);
}

// ── DELETE ──────────────────────────────────────────────────────────────────
export function deleteEvent(id: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM events WHERE id = ?`, [id]);
}

// ── PUBLIC HELPERS (Partner Sync safe — never includes private events) ───────
export function getPublicEventsForMonth(
  contactId: string,
  year: number,
  month: number
): LoveEvent[] {
  const db = getDb();
  const start = new Date(year, month, 1).getTime();
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ? AND is_private = 0`,
    [contactId, start, end]
  );
}

export function getPublicEventsByDate(contactId: string, dateMs: number): LoveEvent[] {
  const db = getDb();
  const startOfDay = new Date(dateMs);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dateMs);
  endOfDay.setHours(23, 59, 59, 999);
  return db.getAllSync<LoveEvent>(
    `SELECT * FROM events
     WHERE contact_id = ? AND occurred_at >= ? AND occurred_at <= ? AND is_private = 0
     ORDER BY occurred_at ASC`,
    [contactId, startOfDay.getTime(), endOfDay.getTime()]
  );
}

// ── STATS ───────────────────────────────────────────────────────────────────
export function getEventCountByType(contactId: string): Record<string, number> {
  const db = getDb();
  const rows = db.getAllSync<{ type: string; count: number }>(
    `SELECT type, COUNT(*) as count FROM events WHERE contact_id = ? GROUP BY type`,
    [contactId]
  );
  return Object.fromEntries(rows.map((r) => [r.type, r.count]));
}

export function getDaysSinceLast(contactId: string, type: EventTypeKey): number | null {
  const db = getDb();
  const row = db.getFirstSync<{ occurred_at: number }>(
    `SELECT occurred_at FROM events WHERE contact_id = ? AND type = ? ORDER BY occurred_at DESC LIMIT 1`,
    [contactId, type]
  );
  if (!row) return null;
  return Math.floor((Date.now() - row.occurred_at) / 86400000);
}
