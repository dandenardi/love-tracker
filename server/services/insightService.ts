import pool from '../db/pool';
import { AuthService } from './authService';
import { EntitlementService } from './entitlementService';
import { oneWayHash } from './hash';
import {
  AIInsightProvider,
  AnonymizedEventSummary,
  AnthropicInsightProvider,
  InsightDomain,
  InsightResult,
} from './aiInsightProvider';

const MIN_EVENTS_THRESHOLD = 5;
const MIN_RELATIONSHIP_EVENTS = 3; // spec 008: events a relationship needs to "count"
const MIN_RELATIONSHIPS = 2; // spec 008: distinct qualifying relationships required for `profile`
const PROFILE_EVENT_CAP = 300; // spec 008: most recent events pooled across all relationships

// spec 002 Non-Functional rate limit, now per-domain (spec 008: `profile` is a slower-changing,
// identity-level insight, refreshed weekly instead of daily).
const CACHE_DURATION_MS: Record<InsightDomain, number> = {
  solo: 24 * 60 * 60 * 1000,
  couple: 24 * 60 * 60 * 1000,
  profile: 7 * 24 * 60 * 60 * 1000,
};

// spec 007: shared daily throttle for period-scoped requests, which are never cached in
// `ai_insights` and so have no cache row of their own to naturally rate-limit against.
const PERIOD_QUERY_THROTTLE_MS = 24 * 60 * 60 * 1000;

export type InsightOutcome =
  | { status: 'ok'; insight: InsightResult }
  | { status: 'consent_required' }
  | { status: 'premium_required' }
  | { status: 'not_enough_data'; eventCount: number; threshold: number }
  | { status: 'not_enough_relationships'; relationshipCount: number; threshold: number }
  | { status: 'no_partner' }
  | { status: 'rate_limited' };

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

  static async generateOrGetInsight(
    userId: string,
    domain: InsightDomain,
    locale: string,
    from?: number,
    to?: number
  ): Promise<InsightOutcome> {
    const optedIn = await this.getOptIn(userId);
    if (!optedIn) {
      return { status: 'consent_required' };
    }

    // spec 007: a period-scoped request (solo/couple only — `profile` never accepts from/to,
    // enforced at the route) bypasses the ai_insights cache row entirely — it's never stored,
    // always generated live, so it can't reuse the domain's normal cache-driven throttle.
    const isPeriodScoped = domain !== 'profile' && (from !== undefined || to !== undefined);

    let cachedRow: any = null;
    if (!isPeriodScoped) {
      // Cached rows are served regardless of current premium status — per spec 003's lapsed-
      // subscription decision, previously-generated insights stay visible read-only; only
      // generating a NEW one requires an active subscription (checked below).
      const cached = await pool.query('SELECT * FROM ai_insights WHERE user_id = $1 AND domain = $2', [userId, domain]);
      cachedRow = cached.rows[0] ?? null;
      if (cachedRow && Date.now() - Number(cachedRow.generated_at) < CACHE_DURATION_MS[domain]) {
        return { status: 'ok', insight: this.rowToInsight(cachedRow) };
      }
    }

    const isPremium = await EntitlementService.isPremium(userId);
    if (!isPremium) {
      if (cachedRow) {
        // Stale (past its domain's cache window) but the user can't refresh without premium —
        // still better than nothing.
        return { status: 'ok', insight: this.rowToInsight(cachedRow) };
      }
      return { status: 'premium_required' };
    }

    if (isPeriodScoped) {
      const userRow = await pool.query('SELECT ai_insight_last_generated_at FROM users WHERE id = $1', [userId]);
      const last = userRow.rows[0]?.ai_insight_last_generated_at;
      if (last && Date.now() - Number(last) < PERIOD_QUERY_THROTTLE_MS) {
        return { status: 'rate_limited' };
      }
    }

    let events: AnonymizedEventSummary[];

    if (domain === 'profile') {
      const built = await this.buildRelationshipSummaries(userId);
      if (built.events.length < MIN_EVENTS_THRESHOLD) {
        return { status: 'not_enough_data', eventCount: built.events.length, threshold: MIN_EVENTS_THRESHOLD };
      }
      if (built.qualifyingRelationshipCount < MIN_RELATIONSHIPS) {
        return {
          status: 'not_enough_relationships',
          relationshipCount: built.qualifyingRelationshipCount,
          threshold: MIN_RELATIONSHIPS,
        };
      }
      events = built.events;
    } else {
      const built = await this.buildEventSummaries(userId, domain, from, to);
      if (built === null) {
        return { status: 'no_partner' };
      }
      if (built.length < MIN_EVENTS_THRESHOLD) {
        return { status: 'not_enough_data', eventCount: built.length, threshold: MIN_EVENTS_THRESHOLD };
      }
      events = built;
    }

    const result = await provider.generateInsight({ userId, domain, events, locale });

    // spec 007: every successful generation (default or period-scoped) updates the shared
    // throttle timestamp, so period-scoped queries can't bypass the daily cost/abuse limit.
    await pool.query('UPDATE users SET ai_insight_last_generated_at = $1 WHERE id = $2', [result.generatedAt, userId]);

    if (!isPeriodScoped) {
      await pool.query(
        `INSERT INTO ai_insights (user_id, domain, title, body, evidence_event_ids, evidence_relationship_ids, confidence, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, domain) DO UPDATE SET
           title = EXCLUDED.title,
           body = EXCLUDED.body,
           evidence_event_ids = EXCLUDED.evidence_event_ids,
           evidence_relationship_ids = EXCLUDED.evidence_relationship_ids,
           confidence = EXCLUDED.confidence,
           generated_at = EXCLUDED.generated_at`,
        [
          userId,
          domain,
          result.title,
          result.body,
          result.evidenceEventIds,
          result.evidenceRelationshipIds ?? null,
          result.confidence,
          result.generatedAt,
        ]
      );
    }

    return { status: 'ok', insight: result };
  }

  private static rowToInsight(row: any): InsightResult {
    return {
      title: row.title,
      body: row.body,
      evidenceEventIds: row.evidence_event_ids,
      evidenceRelationshipIds: row.evidence_relationship_ids ?? undefined,
      confidence: row.confidence,
      generatedAt: Number(row.generated_at),
    };
  }

  /**
   * Returns null only for 'couple' domain with no active partnership.
   * `id` on each summary is the event's `client_id` — the same id the mobile app uses
   * locally — so evidenceEventIds can be matched back to real logged events on-device.
   * `from`/`to` (epoch ms, inclusive) optionally scope the window — spec 007. Omitted =
   * full history, unchanged from the original behavior.
   */
  private static async buildEventSummaries(
    userId: string,
    domain: 'solo' | 'couple',
    from?: number,
    to?: number
  ): Promise<AnonymizedEventSummary[] | null> {
    let rows: any[];

    if (domain === 'solo') {
      const conditions = ['user_id = $1', 'deleted_at IS NULL'];
      const params: any[] = [userId];
      if (from !== undefined) {
        params.push(from);
        conditions.push(`occurred_at >= $${params.length}`);
      }
      if (to !== undefined) {
        params.push(to);
        conditions.push(`occurred_at <= $${params.length}`);
      }
      const result = await pool.query(
        `SELECT client_id, type, intensity, mood_tag, occurred_at, contact_token FROM events
         WHERE ${conditions.join(' AND ')}
         ORDER BY occurred_at ASC`,
        params
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
      const conditions = [
        'deleted_at IS NULL',
        '((partnership_id = ANY($1) AND is_private = 0) OR (user_id = $2 AND is_private = 1))',
      ];
      const params: any[] = [activePartnershipIds, userId];
      if (from !== undefined) {
        params.push(from);
        conditions.push(`occurred_at >= $${params.length}`);
      }
      if (to !== undefined) {
        params.push(to);
        conditions.push(`occurred_at <= $${params.length}`);
      }
      const result = await pool.query(
        `SELECT client_id, type, intensity, mood_tag, occurred_at FROM events
         WHERE ${conditions.join(' AND ')}
         ORDER BY occurred_at ASC`,
        params
      );
      rows = result.rows;
    }

    return mapRowsToEventSummaries(rows);
  }

  /**
   * spec 008 ("profile" domain): the user's own-authored events across their ENTIRE
   * relationship history — every past and current partnership (dissolved or active, already
   * retained server-side per spec 004's own-author backup) plus solo/casual dating — pooled
   * together, capped at the PROFILE_EVENT_CAP most recent events. Each event is tagged with a
   * unified, one-way-hashed `relationshipId` (hashed partnership_id for couple-sourced rows,
   * or the existing contactToken for solo ones) so the model can detect patterns recurring
   * across different relationships. The raw partnership_id is never sent to the AI provider —
   * see spec 008 Privacy & Safety.
   */
  private static async buildRelationshipSummaries(
    userId: string
  ): Promise<{ events: AnonymizedEventSummary[]; qualifyingRelationshipCount: number }> {
    const result = await pool.query(
      `SELECT client_id, type, intensity, mood_tag, occurred_at, contact_token, partnership_id FROM events
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY occurred_at DESC
       LIMIT $2`,
      [userId, PROFILE_EVENT_CAP]
    );

    // Re-ascend so the earliest retained event anchors dayOffset (mapRowsToEventSummaries
    // assumes rows[0] is the earliest).
    const rows = result.rows.reverse().map((row) => ({
      ...row,
      relationship_id: row.partnership_id ? oneWayHash(row.partnership_id) : row.contact_token || null,
    }));

    const qualifyingRelationshipCount = countQualifyingRelationships(rows, MIN_RELATIONSHIP_EVENTS);

    return { events: mapRowsToEventSummaries(rows), qualifyingRelationshipCount };
  }
}

/**
 * spec 008: a relationship only "counts" toward the profile domain's diversity minimum if it
 * has at least `minEventsPerRelationship` events — filters out a single logged encounter
 * masquerading as a "relationship."
 */
export function countQualifyingRelationships(
  rows: { relationship_id?: string | null }[],
  minEventsPerRelationship: number
): number {
  const eventCountByRelationship = new Map<string, number>();
  for (const row of rows) {
    if (!row.relationship_id) continue;
    eventCountByRelationship.set(row.relationship_id, (eventCountByRelationship.get(row.relationship_id) ?? 0) + 1);
  }
  return [...eventCountByRelationship.values()].filter((count) => count >= minEventsPerRelationship).length;
}

export function mapRowsToEventSummaries(
  rows: {
    client_id: string;
    type: string;
    intensity: number;
    mood_tag?: string | null;
    occurred_at: number | string;
    contact_token?: string | null;
    relationship_id?: string | null;
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
    relationshipId: row.relationship_id || undefined,
  }));
}
