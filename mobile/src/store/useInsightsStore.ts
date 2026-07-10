import { create } from 'zustand';
import { insightsApi } from '@/services/syncApi';
import { InsightDomain, InsightResponse } from '@/types/shared';

interface InsightsState {
  loading: boolean;
  error: string | null;
  responses: Partial<Record<InsightDomain, InsightResponse>>;
  setConsent: (optIn: boolean) => Promise<void>;
  fetchInsight: (domain: InsightDomain, locale: string) => Promise<void>;
}

export const useInsightsStore = create<InsightsState>((set) => ({
  loading: false,
  error: null,
  responses: {},

  setConsent: async (optIn) => {
    await insightsApi.setConsent(optIn);
  },

  fetchInsight: async (domain, locale) => {
    set({ loading: true, error: null });
    try {
      const response = await insightsApi.get(domain, locale);
      set((s) => ({ responses: { ...s.responses, [domain]: response }, loading: false }));
    } catch (err: any) {
      set({ loading: false, error: err?.message || 'Failed to load insight' });
    }
  },
}));
