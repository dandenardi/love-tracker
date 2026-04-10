export type EventTypeKey =
  | 'INTIMACY'
  | 'FIGHT'
  | 'SPECIAL'
  | 'MILESTONE'
  | 'DATE'
  | 'AFFECTION'
  | 'CUSTOM';

export interface EventTypeConfig {
  key: EventTypeKey;
  icon: string;
  labelKey: string; // i18n key
  color: string;
  bgColor: string;
}

export const EVENT_TYPES: EventTypeConfig[] = [
  { key: 'INTIMACY',  icon: '🔥', labelKey: 'events.intimacy',  color: '#E85D75', bgColor: '#3D1A22' },
  { key: 'FIGHT',     icon: '⚡', labelKey: 'events.fight',     color: '#F4A261', bgColor: '#3D2310' },
  { key: 'AFFECTION', icon: '❤️', labelKey: 'events.affection', color: '#FF6B6B', bgColor: '#3D1616' },
  { key: 'DATE',      icon: '🌙', labelKey: 'events.date',      color: '#A78BFA', bgColor: '#1E1533' },
  { key: 'SPECIAL',   icon: '⭐', labelKey: 'events.special',   color: '#FFD166', bgColor: '#332B10' },
  { key: 'MILESTONE', icon: '💋', labelKey: 'events.milestone', color: '#E63946', bgColor: '#3D1216' },
  { key: 'CUSTOM',    icon: '✏️', labelKey: 'events.custom',    color: '#4ECDC4', bgColor: '#0F2E2C' },
];

export const EVENT_TYPE_MAP = Object.fromEntries(
  EVENT_TYPES.map((t) => [t.key, t])
) as Record<EventTypeKey, EventTypeConfig>;

export const MOOD_TAGS = [
  { emoji: '🥰', key: 'inLove',    labelKey: 'moods.inLove' },
  { emoji: '😄', key: 'happy',     labelKey: 'moods.happy' },
  { emoji: '😔', key: 'sad',       labelKey: 'moods.sad' },
  { emoji: '😤', key: 'frustrated',labelKey: 'moods.frustrated' },
  { emoji: '😌', key: 'peaceful',  labelKey: 'moods.peaceful' },
  { emoji: '🔥', key: 'passionate',labelKey: 'moods.passionate' },
  { emoji: '😢', key: 'hurt',      labelKey: 'moods.hurt' },
  { emoji: '😎', key: 'confident', labelKey: 'moods.confident' },
];
