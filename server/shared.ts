export type EventTypeKey =
  | 'INTIMACY'
  | 'FIGHT'
  | 'AFFECTION'
  | 'DATE'
  | 'SPECIAL'
  | 'MILESTONE'
  | 'CUSTOM';

export interface LoveEvent {
  id: string;
  contact_id: string;
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
}

// ── Sync ─────────────────────────────────────────────────────────────────────

/** A public event as stored/exchanged on the server. is_private is intentionally absent. */
export interface ServerEvent {
  clientId: string;
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
  events: ServerEvent[];
  deletedIds: string[];
}
