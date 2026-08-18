import pool from '../db/pool';
import { AuthService } from './authService';
import { EntitlementService } from './entitlementService';
import {
  AIInsightProvider,
  AnonymizedEventSummary,
  AnthropicInsightProvider,
  InsightDomain,
  InsightResult,
} from './aiInsightProvider';

const MIN_EVENTS_THRESHOLD = 5;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day — spec 002 Non-Functional rate limit

export type InsightOutcome =
  | { status: 'ok'; insight: InsightResult }
  | { status: 'consent_required' }
  | { status: 'premium_required' }
  | { status: 'not_enough_data'; eventCount: number; threshold: number }
  | { status: 'no_partner' };

// Route handlers depend only on this service (and, transitively, the AIInsightProvider
// interface) — the concrete Anthropic implementation is a singleton created here, per
// spec 002 FR1 ("route handlers depend only on the interface").
const provider: AIInsightProvider = new AnthropicInsightProvider();

export class InsightService {
  static async setOptIn(userId: string, optIn: boolean): Promise<void> {
    await pool.query('UPDATE users SET ai_insights_opt_in = $1 WHERE id = $2', [optIn, userId]);
  }

  static async getOptIn(userId: string): Promise<boolean> {
    const result = await pool.query('SELECT ai_insights_opt_in FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.ai_insights_opt_in ?? false;
  }

  static async generateOrGetInsight(userId: string, domain: InsightDomain, locale: string): Promise<InsightOutcome> {
    const optedIn = await this.getOptIn(userId);
    if (!optedIn) {
      return { status: 'consent_required' };
    }

    // Cached rows are served regardless of current premium status — per spec 003's lapsed-
    // subscription decision, previously-generated insights stay visible read-only; only
    // generating a NEW one requires an active subscription (checked below).
    const cached = await pool.query('SELECT * FROM ai_insights WHERE user_id = $1 AND domain = $2', [userId, domain]);
    const cachedRow = cached.rows[0];
    if (cachedRow && Date.now() - Number(cachedRow.generated_at) < CACHE_DURATION_MS) {
      return { status: 'ok', insight: this.rowToInsight(cachedRow) };
    }

    const isPremium = await EntitlementService.isPremium(userId);
    if (!isPremium) {
      if (cachedRow) {
        // Stale (>24h) but the user can't refresh without premium — still better than nothing.
        return { status: 'ok', insight: this.rowToInsight(cachedRow) };
      }
      return { status: 'premium_required' };
    }

    const events = await this.buildEventSummaries(userId, domain);
    if (events === null) {
      return { status: 'no_partner' };
    }
    if (events.length < MIN_EVENTS_THRESHOLD) {
      return { status: 'not_enough_data', eventCount: events.length, threshold: MIN_EVENTS_THRESHOLD };
    }

    const result = await provider.generateInsight({ userId, domain, events, locale });

    await pool.query(
      `INSERT INTO ai_insights (user_id, domain, title, body, evidence_event_ids, confidence, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, domain) DO UPDATE SET
         title = EXCLUDED.title,
         body = EXCLUDED.body,
         evidence_event_ids = EXCLUDED.evidence_event_ids,
         confidence = EXCLUDED.confidence,
         generated_at = EXCLUDED.generated_at`,
      [userId, domain, result.title, result.body, result.evidenceEventIds, result.confidence, result.generatedAt]
    );

    return { status: 'ok', insight: result };
  }

  private static rowToInsight(row: any): InsightResult {
    return {
      title: row.title,
      body: row.body,
      evidenceEventIds: row.evidence_event_ids,
      confidence: row.confidence,
      generatedAt: Number(row.generated_at),
    };
  }

  /**
   * Returns null only for 'couple' domain with no active partnership.
   * `id` on each summary is the event's `client_id` — the same id the mobile app uses
   * locally — so evidenceEventIds can be matched back to real logged events on-device.
   */
  private static async buildEventSummaries(userId: string, domain: InsightDomain): Promise<AnonymizedEventSummary[] | null> {
    let rows: any[];

    if (domain === 'solo') {
      const result = await pool.query(
        `SELECT client_id, type, intensity, mood_tag, occurred_at, contact_token FROM events
         WHERE user_id = $1 AND deleted_at IS NULL
         ORDER BY occurred_at ASC`,
        [userId]
      );
      rows = result.rows;
    } else {
      const partners = await AuthService.getPartnerships(userId);
      const activePartnershipIds = partners.filter((p) => p.status === 'active').map((p) => p.partnershipId);
      if (activePartnershipIds.length === 0) {
        return null;
      }
      // Shared non-private events (either partner's authorship) + this user's own private
      // layer. A partner's private events are structurally excluded — never queried.
      const result = await pool.query(
        `SELECT client_id, type, intensity, mood_tag, occurred_at FROM events
         WHERE deleted_at IS NULL
         AND ((partnership_id = ANY($1) AND is_private = 0) OR (user_id = $2 AND is_private = 1))
         ORDER BY occurred_at ASC`,
        [activePartnershipIds, userId]
      );
      rows = result.rows;
    }

    return mapRowsToEventSummaries(rows);
  }
}

export function mapRowsToEventSummaries(
  rows: {
    client_id: string;
    type: string;
    intensity: number;
    mood_tag?: string | null;
    occurred_at: number | string;
    contact_token?: string | null;
  }[]
): AnonymizedEventSummary[] {
  if (rows.length === 0) return [];

  const earliestOccurredAt = Number(rows[0].occurred_at);
  return rows.map((row) => ({
    id: row.client_id,
    type: row.type,
    intensity: row.intensity,
    moodTag: row.mood_tag || undefined,
    dayOffset: Math.floor((Number(row.occurred_at) - earliestOccurredAt) / 86400000),
    contactToken: row.contact_token || undefined,
  }));
}
