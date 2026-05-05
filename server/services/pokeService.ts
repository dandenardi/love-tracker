import pool from '../db/pool';
import { PokePayload, Poke } from '../shared';
import { sendExpoPushNotification } from './notificationService';

export class PokeService {
  /**
   * Send a poke from one user to a partner.
   * Validates active partnership, persists the poke, then fires push notification.
   */
  static async sendPoke(senderId: string, payload: PokePayload): Promise<void> {
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
    await pool.query(
      `INSERT INTO pokes (sender_id, recipient_id, partnership_id, message, emoji, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [senderId, partnerId, partnershipId, message, emoji, sentAt]
    );

    // 3. Fetch sender alias and recipient push token
    const [senderResult, recipientResult] = await Promise.all([
      pool.query('SELECT alias FROM users WHERE id = $1', [senderId]),
      pool.query('SELECT push_token FROM users WHERE id = $1', [partnerId]),
    ]);

    const senderAlias = senderResult.rows[0]?.alias || 'Your partner';
    const recipientToken = recipientResult.rows[0]?.push_token;

    // 4. Send push notification (fire-and-forget)
    if (recipientToken) {
      await sendExpoPushNotification(
        recipientToken,
        senderAlias,
        `${senderAlias} ${message} ${emoji}`,
        { type: 'poke', senderId, message, emoji }
      );
    } else {
      console.warn('[PokeService] Recipient has no push token, skipping notification');
    }
  }

  /**
   * Retrieve pokes received by a user since a given timestamp.
   */
  static async getPokes(userId: string, since: number): Promise<Poke[]> {
    const result = await pool.query(
      `SELECT pk.id, pk.sender_id, u.alias as sender_alias,
              pk.message, pk.emoji, pk.sent_at, pk.read_at
       FROM pokes pk
       JOIN users u ON u.id = pk.sender_id
       WHERE pk.recipient_id = $1 AND pk.sent_at > $2
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
      readAt: row.read_at ? Number(row.read_at) : undefined,
    }));
  }

  /**
   * Mark a poke as read.
   */
  static async markRead(userId: string, pokeId: string): Promise<void> {
    await pool.query(
      'UPDATE pokes SET read_at = $1 WHERE id = $2 AND recipient_id = $3',
      [Date.now(), pokeId, userId]
    );
  }
}
