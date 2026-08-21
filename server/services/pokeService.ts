import pool from '../db/pool';
import { PokePayload, Poke } from '../shared';
import { sendExpoPushNotification } from './notificationService';
import { socketManager } from '../socket';
import { normalizeLocale, pokeSentBody, pokeDeliveredBody } from './pushTemplates';

export class PokeService {
  /**
   * Send a poke from one user to a partner.
   * Validates active partnership, persists the poke, then fires push notification.
   */
  static async sendPoke(senderId: string, payload: PokePayload): Promise<string> {
    const { partnerId, message, emoji } = payload;

    // 1. Validate active partnership exists between the two users
    const u1 = senderId < partnerId ? senderId : partnerId;
    const u2 = senderId < partnerId ? partnerId : senderId;

    const partnershipResult = await pool.query(
      `SELECT p.id as partnership_id
       FROM partnerships p
       WHERE p.user_id_1 = $1 AND p.user_id_2 = $2 AND p.status = 'active'`,
      [u1, u2]
    );

    if (partnershipResult.rows.length === 0) {
      throw new Error('No active partnership found with this partner');
    }

    const partnershipId = partnershipResult.rows[0].partnership_id;
    const sentAt = Date.now();

    // 2. Insert poke record
    const insertResult = await pool.query(
      `INSERT INTO pokes (sender_id, recipient_id, partnership_id, message, emoji, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [senderId, partnerId, partnershipId, message, emoji, sentAt]
    );
    const pokeId = insertResult.rows[0].id;

    // 3. Fetch sender alias and recipient push token
    const [senderResult, recipientResult] = await Promise.all([
      pool.query('SELECT alias FROM users WHERE id = $1', [senderId]),
      pool.query('SELECT push_token, locale FROM users WHERE id = $1', [partnerId]),
    ]);

    const senderAlias = senderResult.rows[0]?.alias || 'Your partner';
    const recipientToken = recipientResult.rows[0]?.push_token;
    const recipientLocale = normalizeLocale(recipientResult.rows[0]?.locale);

    // 4. Send push notification (fire-and-forget)
    if (recipientToken) {
      await sendExpoPushNotification(
        recipientToken,
        senderAlias,
        pokeSentBody(recipientLocale, senderAlias, emoji),
        { type: 'poke', pokeId, senderId, recipientId: partnerId, partnerId: senderId, message, emoji },
        'POKE_CATEGORY'
      );
    }

    // 5. Emit real-time socket event (fire-and-forget)
    socketManager.emitToUser(partnerId, 'new_poke', {
      id: pokeId,
      senderId,
      senderAlias,
      message,
      emoji,
      sentAt,
    });

    return pokeId;
  }

  /**
   * Retrieve pokes received by a user since a given timestamp.
   */
  static async getPokes(userId: string, since: number): Promise<Poke[]> {
    // Only pokes tied to a currently active partnership are returned. Unpairing (status
    // flips to 'unpaired') or deleting the partnership (FK ON DELETE SET NULL) both make
    // the INNER JOIN exclude the poke, so a dissolved partnership's pokes stop surfacing.
    const result = await pool.query(
      `SELECT pk.id, pk.sender_id, u.alias as sender_alias,
              pk.message, pk.emoji, pk.sent_at, pk.delivered_at, pk.read_at
       FROM pokes pk
       JOIN users u ON u.id = pk.sender_id
       JOIN partnerships p ON p.id = pk.partnership_id
       WHERE (pk.recipient_id = $1 OR pk.sender_id = $1) AND pk.sent_at > $2 AND p.status = 'active'
       ORDER BY pk.sent_at DESC
       LIMIT 50`,
      [userId, since]
    );

    return result.rows.map(row => ({
      id: row.id,
      senderId: row.sender_id,
      senderAlias: row.sender_alias,
      message: row.message,
      emoji: row.emoji,
      sentAt: Number(row.sent_at),
      deliveredAt: row.delivered_at ? Number(row.delivered_at) : undefined,
      readAt: row.read_at ? Number(row.read_at) : undefined,
    }));
  }

  /**
   * Mark a poke as delivered.
   */
  static async markDelivered(userId: string, pokeId: string): Promise<void> {
    const now = Date.now();
    const result = await pool.query(
      `UPDATE pokes 
       SET delivered_at = COALESCE(delivered_at, $1) 
       WHERE id = $2 AND recipient_id = $3
       RETURNING sender_id, delivered_at`,
      [now, pokeId, userId]
    );

    if (result.rows.length > 0) {
      const { sender_id, delivered_at } = result.rows[0];
      
      // If we just set it (it was null), notify the sender
      if (Number(delivered_at) === now) {
        socketManager.emitToUser(sender_id, 'poke_status_updated', {
          pokeId,
          deliveredAt: now,
        });

        // Send push notification to sender: "Partner received your poke!"
        const [recipientResult, senderResult] = await Promise.all([
          pool.query('SELECT alias FROM users WHERE id = $1', [userId]),
          pool.query('SELECT push_token, locale FROM users WHERE id = $1', [sender_id]),
        ]);

        const recipientAlias = recipientResult.rows[0]?.alias || 'Your partner';
        const senderToken = senderResult.rows[0]?.push_token;
        const senderLocale = normalizeLocale(senderResult.rows[0]?.locale);

        if (senderToken) {
          await sendExpoPushNotification(
            senderToken,
            recipientAlias,
            pokeDeliveredBody(senderLocale, recipientAlias),
            { type: 'poke_delivered', pokeId, partnerId: userId, partnerName: recipientAlias },
            'POKE_CATEGORY'
          );
        }
      }
    }
  }

  /**
   * Mark a poke as read.
   */
  static async markRead(userId: string, pokeId: string): Promise<void> {
    const now = Date.now();
    const result = await pool.query(
      `UPDATE pokes 
       SET read_at = COALESCE(read_at, $1),
           delivered_at = COALESCE(delivered_at, $1)
       WHERE id = $2 AND recipient_id = $3
       RETURNING sender_id`,
      [now, pokeId, userId]
    );

    if (result.rows.length > 0) {
      const senderId = result.rows[0].sender_id;
      socketManager.emitToUser(senderId, 'poke_status_updated', {
        pokeId,
        readAt: now,
        deliveredAt: now,
      });
    }
  }
}
