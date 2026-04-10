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
