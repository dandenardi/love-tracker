import pool from '../db/pool';

/**
 * RevenueCat webhook event shape (subset used here).
 * https://www.revenuecat.com/docs/integrations/webhooks/sample-events
 */
export interface RevenueCatWebhookEvent {
  type: string;
  app_user_id: string;
  expiration_at_ms: number | null;
}

export interface RevenueCatWebhookPayload {
  event: RevenueCatWebhookEvent;
  api_version: string;
}

export class EntitlementService {
  static async isPremium(userId: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT premium_active, premium_expires_at FROM users WHERE id = $1',
      [userId]
    );
    const row = result.rows[0];
    if (!row) return false;
    // Re-derive from expiry rather than trusting the cached boolean alone — a webhook
    // could be delayed/missed, and expiration is unambiguous even if premium_active is stale.
    if (row.premium_expires_at && Number(row.premium_expires_at) <= Date.now()) return false;
    return !!row.premium_active;
  }

  static async getStatus(userId: string): Promise<{ premium: boolean; expiresAt: number | null }> {
    const result = await pool.query(
      'SELECT premium_active, premium_expires_at FROM users WHERE id = $1',
      [userId]
    );
    const row = result.rows[0];
    if (!row) return { premium: false, expiresAt: null };
    const expiresAt = row.premium_expires_at ? Number(row.premium_expires_at) : null;
    const premium = !!row.premium_active && (expiresAt === null || expiresAt > Date.now());
    return { premium, expiresAt };
  }

  /**
   * Derives active/expiry purely from `expiration_at_ms` vs now — this one rule correctly
   * handles INITIAL_PURCHASE, RENEWAL, CANCELLATION (still active until expiry),
   * UNCANCELLATION, BILLING_ISSUE, PRODUCT_CHANGE, and EXPIRATION alike, without needing to
   * hardcode a branch per RevenueCat event type.
   */
  static async applyWebhookEvent(event: RevenueCatWebhookEvent): Promise<void> {
    const userId = event.app_user_id;
    const expiresAt = event.expiration_at_ms ?? null;
    const active = expiresAt !== null && expiresAt > Date.now();
    await pool.query(
      'UPDATE users SET premium_active = $1, premium_expires_at = $2 WHERE id = $3',
      [active, expiresAt, userId]
    );
  }
}
