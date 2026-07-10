import { create } from 'zustand';
import { entitlementsApi } from '@/services/syncApi';

interface EntitlementState {
  premium: boolean;
  expiresAt: number | null;
  loading: boolean;
  /** Server-verified refresh — the only source of truth for gating (spec 003 FR6). */
  refresh: () => Promise<void>;
}

export const useEntitlementStore = create<EntitlementState>((set) => ({
  premium: false,
  expiresAt: null,
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const status = await entitlementsApi.me();
      set({ premium: status.premium, expiresAt: status.expiresAt, loading: false });
    } catch (err) {
      console.error('[EntitlementStore] Failed to refresh entitlement status:', err);
      set({ loading: false });
    }
  },
}));
