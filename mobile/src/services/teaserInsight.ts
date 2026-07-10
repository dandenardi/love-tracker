import type { TFunction } from 'i18next';
import type { LoveEvent } from '@/types/shared';
import { EVENT_TYPE_MAP } from '@/constants/eventTypes';

export interface TeaserInsight {
  text: string;
  icon: string;
}

/**
 * Free-tier teaser (spec 003 FR1): a single templated sentence from local stats only —
 * no LLM call, zero cost. Purely a pure function over already-loaded events so it can run
 * from whatever event set the caller has in memory (mirrors stats.tsx's own aggregation).
 */
export function getMonthlyTeaser(events: LoveEvent[], t: TFunction): TeaserInsight | null {
  const now = new Date();
  const countByType: Record<string, number> = {};

  for (const e of events) {
    if (!e.occurred_at || e.type === 'POKE') continue;
    const d = new Date(e.occurred_at);
    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
    countByType[e.type] = (countByType[e.type] ?? 0) + 1;
  }

  const entries = Object.entries(countByType);
  if (entries.length === 0) return null;

  const [topType, topCount] = entries.sort((a, b) => b[1] - a[1])[0];
  const cfg = EVENT_TYPE_MAP[topType as keyof typeof EVENT_TYPE_MAP];

  return {
    icon: cfg?.icon ?? '📝',
    text: t('aiInsights.teaser', { count: topCount, type: t(cfg?.labelKey ?? 'events.custom') }),
  };
}
