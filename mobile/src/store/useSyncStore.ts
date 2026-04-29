import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, syncApi, setAccessToken } from '@/services/syncApi';
import { type ServerEvent } from '@/types/shared';
import { useEventsStore } from './useEventsStore';
import { useContactsStore } from './useContactsStore';

const STORAGE_KEY = '@love-tracker/sync';

async function loadSyncState() {
  const [userId, alias, partnerId, partnerAlias, lastSyncedAt] = await Promise.all([
    AsyncStorage.getItem(`${STORAGE_KEY}/userId`),
    AsyncStorage.getItem(`${STORAGE_KEY}/alias`),
    AsyncStorage.getItem(`${STORAGE_KEY}/partnerId`),
    AsyncStorage.getItem(`${STORAGE_KEY}/partnerAlias`),
    AsyncStorage.getItem(`${STORAGE_KEY}/lastSyncedAt`),
  ]);
  return {
    userId: userId || null,
    alias: alias || null,
    partnerId: partnerId || null,
    partnerAlias: partnerAlias || null,
    lastSyncedAt: lastSyncedAt ? parseInt(lastSyncedAt, 10) : 0,
  };
}

interface SyncState {
  userId: string | null;
  alias: string | null;
  partnerId: string | null;
  partnerAlias: string | null;
  lastSyncedAt: number;
  isSyncing: boolean;
  error: string | null;

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
  userId: null,
  alias: null,
  partnerId: null,
  partnerAlias: null,
  lastSyncedAt: 0,
  isSyncing: false,
  error: null,

  init: async () => {
    try {
      const saved = await loadSyncState();
      set(saved);
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (refreshToken) {
        const { accessToken } = await authApi.refresh(refreshToken);
        setAccessToken(accessToken);
      }
    } catch (err) {
      console.error('Failed to init sync store:', err);
    }
  },

  register: async (email, password, alias) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await authApi.register({ email, password, alias });
      await SecureStore.setItemAsync('refreshToken', res.refreshToken);
      setAccessToken(res.accessToken);
      await Promise.all([
        AsyncStorage.setItem(`${STORAGE_KEY}/userId`, res.userId),
        AsyncStorage.setItem(`${STORAGE_KEY}/alias`, res.alias),
      ]);
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
      await Promise.all([
        AsyncStorage.setItem(`${STORAGE_KEY}/userId`, res.userId),
        AsyncStorage.setItem(`${STORAGE_KEY}/alias`, res.alias),
      ]);
      set({ userId: res.userId, alias: res.alias, isSyncing: false });
      await get().sync();
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('refreshToken');
    setAccessToken(null);
    await Promise.all([
      AsyncStorage.removeItem(`${STORAGE_KEY}/userId`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/alias`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/partnerId`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/partnerAlias`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/lastSyncedAt`),
    ]);
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
      await Promise.all([
        AsyncStorage.setItem(`${STORAGE_KEY}/partnerId`, res.partnerId),
        AsyncStorage.setItem(`${STORAGE_KEY}/partnerAlias`, res.partnerAlias),
      ]);
      set({ partnerId: res.partnerId, partnerAlias: res.partnerAlias, isSyncing: false });
      await get().sync();
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  unpair: async () => {
    await authApi.unpair();
    await Promise.all([
      AsyncStorage.removeItem(`${STORAGE_KEY}/partnerId`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/partnerAlias`),
    ]);
    set({ partnerId: null, partnerAlias: null });
  },

  sync: async () => {
    const { userId, isSyncing, lastSyncedAt } = get();
    if (!userId || isSyncing) return;

    set({ isSyncing: true, error: null });
    try {
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
        unsyncedEvents.forEach(e => {
          useEventsStore.getState().editEvent(e.id, { synced: 1 });
        });
      }

      const res = await syncApi.pull(lastSyncedAt);

      if (res.events.length > 0 || res.deletedIds.length > 0) {
        const { partnerId } = get();
        let partnerContactId = useContactsStore.getState().contacts.find(
          c => c.partner_user_id === partnerId
        )?.id;

        if (partnerId && !partnerContactId) {
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
          res.events.forEach((se: ServerEvent) => {
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
          res.deletedIds.forEach((id: string) => {
            useEventsStore.getState().removeEvent(id);
          });
        }
      }

      const now = Date.now();
      await AsyncStorage.setItem(`${STORAGE_KEY}/lastSyncedAt`, String(now));
      set({ lastSyncedAt: now, isSyncing: false });
    } catch (err: any) {
      console.error('Sync failed:', err);
      set({ error: err.message, isSyncing: false });
    }
  },
}));
