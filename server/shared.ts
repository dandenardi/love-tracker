export type EventTypeKey =
  | 'INTIMACY'
  | 'FIGHT'
  | 'AFFECTION'
  | 'DATE'
  | 'SPECIAL'
  | 'MILESTONE'
  | 'POKE'
  | 'CUSTOM';

export interface LoveEvent {
  id: string;
  /** null = unlinked solo diary entry, not tied to any Contact */
  contact_id?: string | null;
  type: EventTypeKey;
  title?: string;
  note?: string;
  intensity: number;
  mood_tag?: string;
  occurred_at: number;
  logged_at: number;
  synced: number;
  server_id?: string;
  /** 1 = private (never synced to partner), 0 = shared */
  is_private: number;
  delivered_at?: number;
  read_at?: number;
  /** set when soft-deleted locally, pending push confirmation; row is purged once confirmed */
  deleted_at?: number | null;
}

export interface Contact {
  id: string;
  name: string;
  nickname?: string;
  avatar_emoji: string;
  color: string;
  is_partner: number;
  partner_user_id?: string;
  created_at: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface RegisterPayload {
  email: string;
  password: string;
  alias: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
  alias: string;
}

export interface RefreshPayload {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}

// ── Pairing ──────────────────────────────────────────────────────────────────

export interface Partner {
  id: string;
  alias: string;
  partnershipId: string;
  status: 'active' | 'unpaired';
}

export interface InviteCodeResponse {
  code: string;
  expiresAt: number;
}

export interface PairPayload {
  code: string;
}

export interface PairResponse {
  partnerId: string;
  partnerAlias: string;
  partnershipId: string;
}

// ── Sync ─────────────────────────────────────────────────────────────────────

export interface ServerEvent {
  clientId: string;
  /** null = own-only backup, never shared with a partner (private or unlinked events) */
  partnershipId?: string | null;
  /** 1 = private. Own-only backup rows may be 0 or 1; shared rows are always 0. */
  is_private: number;
  /** One-way hash of the local contact_id, solo-domain casual-contact events only. See specs/006. */
  contactToken?: string | null;
  type: EventTypeKey;
  title?: string;
  note?: string;
  intensity: number;
  mood_tag?: string;
  occurred_at: number;
  logged_at: number;
}

export interface SyncPushPayload {
  events: ServerEvent[];
}

export interface SyncPullResponse {
  events: (ServerEvent & { partnerId: string })[];
  /** This user's own private/unlinked events, backed up but never partner-visible. */
  ownEvents: ServerEvent[];
  /** Partner's deletions of shared events. */
  deletedIds: string[];
  /** This user's own deletions, for propagation across their own devices. */
  ownDeletedIds: string[];
  partners: Partner[];
}

// ── Poke ─────────────────────────────────────────────────────────────────────

export interface PokePayload {
  partnerId: string;
  message: string;
  emoji: string;
}

export interface Poke {
  id: string;
  senderId: string;
  senderAlias: string;
  message: string;
  emoji: string;
  sentAt: number;
  deliveredAt?: number;
  readAt?: number;
}

export interface PokesResponse {
  pokes: Poke[];
}

// ── Push Token ────────────────────────────────────────────────────────────────

export interface SavePushTokenPayload {
  token: string;
}

// ── AI Insights (spec 002, extended by specs 007/008) ───────────────────────

export type InsightDomain = 'solo' | 'couple' | 'profile';

export interface AIInsight {
  title: string;
  body: string;
  /** Event client_ids supporting this insight — matches local event ids on-device. */
  evidenceEventIds: string[];
  /** `profile` domain only — the relationshipIds (hashed) that support this finding. */
  evidenceRelationshipIds?: string[];
  confidence: 'low' | 'medium' | 'high';
  generatedAt: number;
}

export type InsightResponse =
  | { status: 'ok'; insight: AIInsight }
  | { status: 'consent_required' }
  | { status: 'premium_required' }
  | { status: 'not_enough_data'; eventCount: number; threshold: number }
  /** `profile` domain only — spec 008. */
  | { status: 'not_enough_relationships'; relationshipCount: number; threshold: number }
  | { status: 'no_partner' }
  /** Period-scoped request (spec 007) hit the shared daily generation throttle. */
  | { status: 'rate_limited' };

export interface InsightConsentPayload {
  optIn: boolean;
}

// ── Premium Entitlements (spec 003) ─────────────────────────────────────────

export interface EntitlementStatus {
  premium: boolean;
  expiresAt: number | null;
}
