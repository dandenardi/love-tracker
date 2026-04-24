import pool from '../db/pool';
import { ServerEvent } from '@love/shared';

export class SyncService {
  static async pushEvents(userId: string, events: ServerEvent[]): Promise<void> {
    if (events.length === 0) return;

    const query = `
      INSERT INTO events (user_id, client_id, type, title, note, intensity, mood_tag, occurred_at, logged_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, client_id) DO UPDATE SET
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        note = EXCLUDED.note,
        intensity = EXCLUDED.intensity,
        mood_tag = EXCLUDED.mood_tag,
        occurred_at = EXCLUDED.occurred_at,
        logged_at = EXCLUDED.logged_at
    `;

    const now = Date.now();
    for (const event of events) {
      await pool.query(query, [
        userId,
        event.clientId,
        event.type,
        event.title || null,
        event.note || null,
        event.intensity,
        event.mood_tag || null,
        event.occurred_at,
        event.logged_at,
        now
      ]);
    }
  }

  static async pullEvents(userId: string, lastPulledAt: number): Promise<{ events: ServerEvent[], deletedIds: string[] }> {
    // Get partner ID
    const userResult = await pool.query('SELECT partner_id FROM users WHERE id = $1', [userId]);
    const partnerId = userResult.rows[0]?.partner_id;

    if (!partnerId) {
      return { events: [], deletedIds: [] };
    }

    // Get events from partner that were created or updated after lastPulledAt
    // We only pull events that are NOT deleted or were deleted after lastPulledAt
    const eventsResult = await pool.query(
      `SELECT * FROM events 
       WHERE user_id = $1 
       AND (created_at > $2 OR logged_at > $2)
       AND deleted_at IS NULL`,
      [partnerId, lastPulledAt]
    );

    const deletedResult = await pool.query(
      `SELECT client_id FROM events 
       WHERE user_id = $1 
       AND deleted_at > $2`,
      [partnerId, lastPulledAt]
    );

    const events: ServerEvent[] = eventsResult.rows.map(row => ({
      clientId: row.client_id,
      type: row.type,
      title: row.title || undefined,
      note: row.note || undefined,
      intensity: row.intensity,
      mood_tag: row.mood_tag || undefined,
      occurred_at: Number(row.occurred_at),
      logged_at: Number(row.logged_at)
    }));

    const deletedIds = deletedResult.rows.map(row => row.client_id);

    return { events, deletedIds };
  }

  static async deleteEvent(userId: string, clientId: string): Promise<void> {
    await pool.query(
      'UPDATE events SET deleted_at = $1 WHERE user_id = $2 AND client_id = $3',
      [Date.now(), userId, clientId]
    );
  }
}
