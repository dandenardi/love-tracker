import pool from '../db/pool';
import { ServerEvent, SyncPullResponse } from '../shared';
import { AuthService } from './authService';
import { sendExpoPushNotification } from './notificationService';
import { socketManager } from '../socket';
import { normalizeLocale, eventLoggedBody } from './pushTemplates';

export class SyncService {
  static async pushEvents(userId: string, events: ServerEvent[]): Promise<void> {
    if (events.length === 0) return;

    const query = `
      INSERT INTO events (user_id, client_id, partnership_id, is_private, contact_token, type, title, note, intensity, mood_tag, occurred_at, logged_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (user_id, client_id) DO UPDATE SET
        partnership_id = EXCLUDED.partnership_id,
        is_private = EXCLUDED.is_private,
        contact_token = EXCLUDED.contact_token,
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
        event.partnershipId ?? null,
        event.is_private ?? 0,
        event.contactToken ?? null,
        event.type,
        event.title || null,
        event.note || null,
        event.intensity,
        event.mood_tag || null,
        event.occurred_at,
        event.logged_at,
        now
      ]);

      // Own-only backup events have no partnership — never notify or look up a partner for them.
      if (!event.partnershipId) continue;

      // Fire push notification to partner (once per partnership, not per event)
      if (!notifiedPartnershipIds.has(event.partnershipId)) {
        notifiedPartnershipIds.add(event.partnershipId);

        // Get partner's ID, push token and locale from the partnership
        const partnerInfoResult = await pool.query(
          `SELECT u.id as partner_id, u.push_token, u.locale FROM users u
           JOIN partnerships p ON (p.user_id_1 = u.id OR p.user_id_2 = u.id)
           WHERE p.id = $1 AND u.id != $2 AND p.status = 'active'`,
          [event.partnershipId, userId]
        );

        for (const row of partnerInfoResult.rows) {
          if (row.push_token) {
            const notifBody = eventLoggedBody(normalizeLocale(row.locale), !isNew, event.type, senderAlias);
            // fire-and-forget — do not await to avoid slowing the sync response
            sendExpoPushNotification(
              row.push_token,
              'Love Tracker',
              notifBody,
              { type: 'event_sync', eventType: event.type }
            );
          }

          // Real-time socket event
          socketManager.emitToUser(row.partner_id, 'data_changed', {
            type: 'event_sync',
            senderAlias,
          });
        }
      }
    }
  }

  static async pullEvents(userId: string, lastPulledAt: number): Promise<SyncPullResponse> {
    // Get all partnerships (active and inactive)
    const partners = await AuthService.getPartnerships(userId);
    const activePartnershipIds = partners.filter(p => p.status === 'active').map(p => p.partnershipId);

    // Full personal backup: every row this user has ever authored (private, unlinked, and
    // their own shared-with-partner events alike), regardless of partnership status. Runs even
    // for users with zero partnerships (Solo Diary-only users). This is what makes "reinstall on
    // a new device" actually recover everything the user logged, not just what a partner shared
    // back to them.
    const ownResult = await pool.query(
      `SELECT * FROM events e
       WHERE e.user_id = $1
       AND (e.created_at > $2 OR e.logged_at > $2)
       AND e.deleted_at IS NULL`,
      [userId, lastPulledAt]
    );

    const ownEvents = ownResult.rows.map(row => ({
      clientId: row.client_id,
      partnershipId: row.partnership_id,
      is_private: row.is_private,
      contactToken: row.contact_token || undefined,
      type: row.type,
      title: row.title || undefined,
      note: row.note || undefined,
      intensity: row.intensity,
      mood_tag: row.mood_tag || undefined,
      occurred_at: Number(row.occurred_at),
      logged_at: Number(row.logged_at)
    }));

    // This user's own deletions, so they propagate to their other devices (see specs/005-deletion-sync).
    const ownDeletedResult = await pool.query(
      `SELECT client_id FROM events WHERE user_id = $1 AND deleted_at > $2`,
      [userId, lastPulledAt]
    );
    const ownDeletedIds = ownDeletedResult.rows.map(row => row.client_id);

    if (activePartnershipIds.length === 0) {
      return { events: [], ownEvents, deletedIds: [], ownDeletedIds, partners };
    }

    // Get events shared with this user across all ACTIVE partnerships.
    // is_private = 0 is a hard security boundary, not an optimization: own-only backup rows
    // never have a partnership_id, but this filter guarantees a private row can never reach a
    // partner even if that invariant were ever violated upstream.
    const eventsResult = await pool.query(
      `SELECT e.*, e.user_id as sender_id FROM events e
       WHERE e.partnership_id = ANY($1)
       AND e.user_id != $2
       AND e.is_private = 0
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
      is_private: row.is_private,
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

    return { events, ownEvents, deletedIds, ownDeletedIds, partners };
  }

  static async deleteEvent(userId: string, clientId: string): Promise<void> {
    await pool.query(
      'UPDATE events SET deleted_at = $1 WHERE user_id = $2 AND client_id = $3',
      [Date.now(), userId, clientId]
    );
  }
}
