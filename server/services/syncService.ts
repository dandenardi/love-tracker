import pool from '../db/pool';
import { ServerEvent, SyncPullResponse } from '../shared';
import { AuthService } from './authService';
import { sendExpoPushNotification } from './notificationService';

/** Human-readable label + emoji for each event type key */
const EVENT_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  INTIMACY:  { label: 'Intimacy',  emoji: '🔥' },
  FIGHT:     { label: 'Fight',     emoji: '⚡' },
  AFFECTION: { label: 'Affection', emoji: '❤️' },
  DATE:      { label: 'Date',      emoji: '🌙' },
  SPECIAL:   { label: 'Special',   emoji: '⭐' },
  MILESTONE: { label: 'Milestone', emoji: '💋' },
  CUSTOM:    { label: 'Custom',    emoji: '✏️' },
};

export class SyncService {
  static async pushEvents(userId: string, events: ServerEvent[]): Promise<void> {
    if (events.length === 0) return;

    const query = `
      INSERT INTO events (user_id, client_id, partnership_id, type, title, note, intensity, mood_tag, occurred_at, logged_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (user_id, client_id) DO UPDATE SET
        partnership_id = EXCLUDED.partnership_id,
        type = EXCLUDED.type,
        title = EXCLUDED.title,
        note = EXCLUDED.note,
        intensity = EXCLUDED.intensity,
        mood_tag = EXCLUDED.mood_tag,
        occurred_at = EXCLUDED.occurred_at,
        logged_at = EXCLUDED.logged_at
    `;

    const now = Date.now();

    // Fetch sender alias once for notifications
    const senderResult = await pool.query('SELECT alias FROM users WHERE id = $1', [userId]);
    const senderAlias: string = senderResult.rows[0]?.alias || 'Your partner';

    // Track which partnerships need notifications (deduplicated)
    const notifiedPartnershipIds = new Set<string>();

    for (const event of events) {
      // Check if this is a new event or an update
      const existingResult = await pool.query(
        'SELECT id FROM events WHERE user_id = $1 AND client_id = $2',
        [userId, event.clientId]
      );
      const isNew = existingResult.rows.length === 0;

      await pool.query(query, [
        userId,
        event.clientId,
        event.partnershipId,
        event.type,
        event.title || null,
        event.note || null,
        event.intensity,
        event.mood_tag || null,
        event.occurred_at,
        event.logged_at,
        now
      ]);

      // Fire push notification to partner (once per partnership, not per event)
      if (!notifiedPartnershipIds.has(event.partnershipId)) {
        notifiedPartnershipIds.add(event.partnershipId);
        const typeInfo = EVENT_TYPE_LABELS[event.type] || { label: event.type, emoji: '📝' };
        const notifBody = isNew
          ? `${senderAlias} logged ${typeInfo.label} ${typeInfo.emoji}`
          : `${senderAlias} updated ${typeInfo.label} ${typeInfo.emoji}`;

        // Get partner's push token from the partnership
        const partnerTokenResult = await pool.query(
          `SELECT u.push_token FROM users u
           JOIN partnerships p ON (p.user_id_1 = u.id OR p.user_id_2 = u.id)
           WHERE p.id = $1 AND u.id != $2 AND p.status = 'active'`,
          [event.partnershipId, userId]
        );

        for (const row of partnerTokenResult.rows) {
          if (row.push_token) {
            // fire-and-forget — do not await to avoid slowing the sync response
            sendExpoPushNotification(
              row.push_token,
              'Love Tracker',
              notifBody,
              { type: 'event_sync', eventType: event.type }
            );
          }
        }
      }
    }
  }

  static async pullEvents(userId: string, lastPulledAt: number): Promise<SyncPullResponse> {
    // Get all partnerships (active and inactive)
    const partners = await AuthService.getPartnerships(userId);
    const activePartnershipIds = partners.filter(p => p.status === 'active').map(p => p.partnershipId);

    if (activePartnershipIds.length === 0) {
      return { events: [], deletedIds: [], partners };
    }

    // Get events shared with this user across all ACTIVE partnerships
    const eventsResult = await pool.query(
      `SELECT e.*, e.user_id as sender_id FROM events e
       WHERE e.partnership_id = ANY($1)
       AND e.user_id != $2
       AND (e.created_at > $3 OR e.logged_at > $3)
       AND e.deleted_at IS NULL`,
      [activePartnershipIds, userId, lastPulledAt]
    );

    const deletedResult = await pool.query(
      `SELECT client_id FROM events 
       WHERE partnership_id = ANY($1)
       AND user_id != $2
       AND deleted_at > $3`,
      [activePartnershipIds, userId, lastPulledAt]
    );

    const events = eventsResult.rows.map(row => ({
      clientId: row.client_id,
      partnershipId: row.partnership_id,
      partnerId: row.sender_id,
      type: row.type,
      title: row.title || undefined,
      note: row.note || undefined,
      intensity: row.intensity,
      mood_tag: row.mood_tag || undefined,
      occurred_at: Number(row.occurred_at),
      logged_at: Number(row.logged_at)
    }));

    const deletedIds = deletedResult.rows.map(row => row.client_id);

    return { events, deletedIds, partners };
  }

  static async deleteEvent(userId: string, clientId: string): Promise<void> {
    await pool.query(
      'UPDATE events SET deleted_at = $1 WHERE user_id = $2 AND client_id = $3',
      [Date.now(), userId, clientId]
    );
  }
}
