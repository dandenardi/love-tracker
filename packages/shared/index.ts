/**
 * Shared types for Love Tracker
 * These are used by both the Mobile App and the Backend Server
 */

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
  occurred_at: number; // unix ms
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
  alias: string; // display name shown to partner
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  userId: string;
  accessToken: string;  // short-lived (15 min)
  refreshToken: string; // long-lived (30 days), stored in Secure Store
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
  code: string;      // 8-char alphanumeric, shown once to the user
  expiresAt: number; // Unix ms — 30-minute window
}

export interface PairPayload {
  code: string;
}

export interface PairResponse {
  partnerId: string;
  partnerAlias: string;
}

// ── Sync ─────────────────────────────────────────────────────────────────────

/**
 * A public event as stored/exchanged on the server.
 * is_private is intentionally absent — private events never leave the device.
 */
export interface ServerEvent {
  clientId: string;      // the device-side UUID — used for dedup and local update
  type: EventTypeKey;
  title?: string;
  note?: string;
  intensity: number;
  mood_tag?: string;
  occurred_at: number;   // Unix ms
  logged_at: number;     // Unix ms
}

export interface SyncPushPayload {
  events: ServerEvent[];
}

export interface SyncPullResponse {
  events: ServerEvent[];
  deletedIds: string[]; // clientIds soft-deleted by the partner
}
