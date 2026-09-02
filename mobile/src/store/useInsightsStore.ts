import { create } from 'zustand';
import { insightsApi } from '@/services/syncApi';
import { InsightDomain, InsightResponse } from '@/types/shared';

interface InsightsState {
  loading: boolean;
  error: string | null;
  responses: Partial<Record<InsightDomain, InsightResponse>>;
  setConsent: (optIn: boolean) => Promise<void>;
  /** `from`/`to` (epoch ms) optionally scope solo/couple to a period — spec 007. */
  fetchInsight: (domain: InsightDomain, locale: string, from?: number, to?: number) => Promise<void>;
}

export const useInsightsStore = create<InsightsState>((set) => ({
  loading: false,
  error: null,
  responses: {},

  setConsent: async (optIn) => {
    await insightsApi.setConsent(optIn);
  },

  fetchInsight: async (domain, locale, from, to) => {
    set({ loading: true, error: null });
    try {
      const response = await insightsApi.get(domain, locale, from, to);
      set((s) => ({ responses: { ...s.responses, [domain]: response }, loading: false }));
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'Failed to load insight' });
    }
  },
}));
