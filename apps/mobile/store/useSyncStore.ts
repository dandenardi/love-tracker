import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { createMMKV, type MMKV } from 'react-native-mmkv';
import { authApi, syncApi, setAccessToken } from '@/services/syncApi';
import { useEventsStore } from './useEventsStore';
import { useContactsStore } from './useContactsStore';
import { LoveEvent } from '@love/shared';

const storage: MMKV = (() => {
  try {
    return createMMKV({ id: 'sync-storage' });
  } catch (e) {
    console.error('MMKV init failed in useSyncStore, falling back to mock');
    return { 
      set: () => {}, 
      getString: () => null, 
      getNumber: () => 0, 
      getBoolean: () => false,
      delete: () => {},
      clearAll: () => {} 
    } as any;
  }
})();

interface SyncState {
  userId: string | null;
  alias: string | null;
  partnerId: string | null;
  partnerAlias: string | null;
  lastSyncedAt: number;
  isSyncing: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  register: (email: string, password: string, alias: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  generateInvite: () => Promise<string>;
  pairWithCode: (code: string) => Promise<void>;
  unpair: () => Promise<void>;
  sync: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  userId: storage.getString('userId') || null,
  alias: storage.getString('alias') || null,
  partnerId: storage.getString('partnerId') || null,
  partnerAlias: storage.getString('partnerAlias') || null,
  lastSyncedAt: storage.getNumber('lastSyncedAt') || 0,
  isSyncing: false,
  error: null,

  init: async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        const { accessToken } = await authApi.refresh(refreshToken);
        setAccessToken(accessToken);
      }
    } catch (err) {
      console.error('Failed to init sync store:', err);
      // If refresh fails, user might need to log in again
    }
  },

  register: async (email, password, alias) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await authApi.register({ email, password, alias });
      await SecureStore.setItemAsync('refreshToken', res.refreshToken);
      setAccessToken(res.accessToken);
      
      storage.set('userId', res.userId);
      storage.set('alias', res.alias);
      
      set({ userId: res.userId, alias: res.alias, isSyncing: false });
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      await SecureStore.setItemAsync('refreshToken', res.refreshToken);
      setAccessToken(res.accessToken);
      
      storage.set('userId', res.userId);
      storage.set('alias', res.alias);
      
      set({ userId: res.userId, alias: res.alias, isSyncing: false });
      
      // After login, try to sync to get existing data
      await get().sync();
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('refreshToken');
    setAccessToken(null);
    storage.delete('userId');
    storage.delete('alias');
    storage.delete('partnerId');
    storage.delete('partnerAlias');
    storage.delete('lastSyncedAt');
    set({ userId: null, alias: null, partnerId: null, partnerAlias: null, lastSyncedAt: 0 });
  },

  generateInvite: async () => {
    const res = await authApi.invite();
    return res.code;
  },

  pairWithCode: async (code) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await authApi.pair(code);
      storage.set('partnerId', res.partnerId);
      storage.set('partnerAlias', res.partnerAlias);
      set({ partnerId: res.partnerId, partnerAlias: res.partnerAlias, isSyncing: false });
      
      // Sync immediately after pairing
      await get().sync();
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  unpair: async () => {
    await authApi.unpair();
    storage.delete('partnerId');
    storage.delete('partnerAlias');
    set({ partnerId: null, partnerAlias: null });
  },

  sync: async () => {
    const { userId, isSyncing, lastSyncedAt } = get();
    if (!userId || isSyncing) return;

    set({ isSyncing: true, error: null });
    try {
      // 1. Push local changes
      const events = useEventsStore.getState().events;
      const unsyncedEvents = events.filter(e => e.synced === 0 && e.is_private === 0);
      
      if (unsyncedEvents.length > 0) {
        await syncApi.push({
          events: unsyncedEvents.map(e => ({
            clientId: e.id,
            type: e.type,
            title: e.title,
            note: e.note,
            intensity: e.intensity,
            mood_tag: e.mood_tag,
            occurred_at: e.occurred_at,
            logged_at: e.logged_at,
          }))
        });
        
        // Mark as synced locally
        unsyncedEvents.forEach(e => {
          useEventsStore.getState().editEvent(e.id, { synced: 1 });
        });
      }

      // 2. Pull partner changes
      const res = await syncApi.pull(lastSyncedAt);
      
      if (res.events.length > 0 || res.deletedIds.length > 0) {
        const { partnerId } = get();
        // We need a contact for the partner to link events
        // If partnerId exists, find or create a contact for them
        let partnerContactId = useContactsStore.getState().contacts.find(c => c.partner_user_id === partnerId)?.id;
        
        if (partnerId && !partnerContactId) {
          // Auto-create partner contact if missing
          const partnerAlias = get().partnerAlias || 'Partner';
          const newContact = useContactsStore.getState().addContact({
            name: partnerAlias,
            avatar_emoji: '❤️',
            color: '#FF6B6B',
            is_partner: 1,
            partner_user_id: partnerId,
          });
          partnerContactId = newContact.id;
        }

        if (partnerContactId) {
          // Apply updates
          res.events.forEach(se => {
            useEventsStore.getState().syncEvent({
              id: se.clientId,
              contact_id: partnerContactId!,
              type: se.type,
              title: se.title,
              note: se.note,
              intensity: se.intensity,
              mood_tag: se.mood_tag,
              occurred_at: se.occurred_at,
              logged_at: se.logged_at,
              synced: 1,
              is_private: 0,
            });
          });

          // Handle deletes (not fully implemented in store yet, but let's at least remove from state)
          res.deletedIds.forEach(id => {
            useEventsStore.getState().removeEvent(id);
          });
        }
      }

      const now = Date.now();
      storage.set('lastSyncedAt', now);
      set({ lastSyncedAt: now, isSyncing: false });
    } catch (err: any) {
      console.error('Sync failed:', err);
      set({ error: err.message, isSyncing: false });
    }
  }
}));
