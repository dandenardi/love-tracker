import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi, syncApi, setAccessToken, onSessionExpired, pokeApi } from '@/services/syncApi';
import { storage } from '@/services/storage';
import { Partner, type ServerEvent } from '@/types/shared';
import { useEventsStore } from './useEventsStore';
import { useContactsStore } from './useContactsStore';
import { usePokeStore } from './usePokeStore';

const STORAGE_KEY = '@love-tracker/sync';

async function loadSyncState() {
  const [userId, alias, partnersJson, lastSyncedAt] = await Promise.all([
    AsyncStorage.getItem(`${STORAGE_KEY}/userId`),
    AsyncStorage.getItem(`${STORAGE_KEY}/alias`),
    AsyncStorage.getItem(`${STORAGE_KEY}/partners`),
    AsyncStorage.getItem(`${STORAGE_KEY}/lastSyncedAt`),
  ]);
  
  let partners: Partner[] = [];
  try {
    if (partnersJson) {
      // Basic validation: must start with [
      if (partnersJson.trim().startsWith('[')) {
        partners = JSON.parse(partnersJson);
      } else {
        console.warn('partnersJson does not look like a JSON array, ignoring:', partnersJson.substring(0, 50));
      }
    }
  } catch (e: any) {
    console.error('Failed to parse partners JSON:', e.message);
    console.error('Offending string (first 100 chars):', partnersJson?.substring(0, 100));
  }

  return {
    userId: userId || null,
    alias: alias || null,
    partners,
    lastSyncedAt: lastSyncedAt ? parseInt(lastSyncedAt, 10) : 0,
  };
}

interface SyncState {
  userId: string | null;
  alias: string | null;
  partners: Partner[];
  lastSyncedAt: number;
  isSyncing: boolean;
  error: string | null;
  pushToken: string | null;

  init: () => Promise<void>;
  register: (email: string, password: string, alias: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  generateInvite: () => Promise<string>;
  pairWithCode: (code: string, contactId?: string, includeHistory?: boolean) => Promise<void>;
  unpair: (partnerId: string) => Promise<void>;
  sync: () => Promise<void>;
  /** Save the Expo push token to state and register it on the server */
  registerPushToken: (token: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  userId: null,
  alias: null,
  partners: [],
  lastSyncedAt: 0,
  isSyncing: false,
  error: null,
  pushToken: null,

  init: async () => {
    try {
      const saved = await loadSyncState();
      set(saved);
      const refreshToken = await storage.getItem('refreshToken');
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
      await storage.setItem('refreshToken', res.refreshToken);
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
      await storage.setItem('refreshToken', res.refreshToken);
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
    await storage.deleteItem('refreshToken');
    setAccessToken(null);
    await Promise.all([
      AsyncStorage.removeItem(`${STORAGE_KEY}/userId`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/alias`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/partners`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/lastSyncedAt`),
    ]);
    set({ userId: null, alias: null, partners: [], lastSyncedAt: 0 });
  },

  generateInvite: async () => {
    const res = await authApi.invite();
    return res.code;
  },

  registerPushToken: async (token: string) => {
    set({ pushToken: token });
    try {
      await pokeApi.savePushToken(token);
      console.log('[SyncStore] Push token registered on server');
    } catch (err: any) {
      console.error('[SyncStore] Failed to register push token:', err.message);
    }
  },

  pairWithCode: async (code, contactId, includeHistory = true) => {
    set({ isSyncing: true, error: null });
    try {
      const res = await authApi.pair(code);
      const newPartner: Partner = {
        id: res.partnerId,
        alias: res.partnerAlias,
        partnershipId: res.partnershipId,
        status: 'active'
      };
      
      const partners = [...get().partners.filter(p => p.id !== res.partnerId), newPartner];
      
      // Link to existing contact if provided, or create a new one
      if (contactId) {
        // If history should NOT be shared, mark all current events as synced (server thinks they are already there)
        if (!includeHistory) {
          useEventsStore.getState().markContactEventsAsSynced(contactId);
        }

        useContactsStore.getState().editContact(contactId, {
          is_partner: 1,
          partner_user_id: res.partnerId
        });
      } else {
        // Auto-create contact for the new partner
        useContactsStore.getState().addContact({
          name: res.partnerAlias,
          avatar_emoji: '❤️',
          color: '#FF6B6B',
          is_partner: 1,
          partner_user_id: res.partnerId,
        });
      }

      await AsyncStorage.setItem(`${STORAGE_KEY}/partners`, JSON.stringify(partners));
      set({ partners, isSyncing: false });
      await get().sync();
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  unpair: async (partnerId) => {
    set({ isSyncing: true, error: null });
    try {
      await authApi.unpair(partnerId);
      const partners = get().partners.map(p => 
        p.id === partnerId ? { ...p, status: 'unpaired' as const } : p
      );
      await AsyncStorage.setItem(`${STORAGE_KEY}/partners`, JSON.stringify(partners));
      set({ partners, isSyncing: false });
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  sync: async () => {
    const { userId, isSyncing, lastSyncedAt, partners } = get();
    if (!userId || isSyncing) return;

    set({ isSyncing: true, error: null });
    try {
      const eventsStore = useEventsStore.getState();
      const contactsStore = useContactsStore.getState();
      
      const unsyncedEvents = eventsStore.events.filter(e => e.synced === 0 && e.is_private === 0);

      // 1. Group events by partner and push
      if (unsyncedEvents.length > 0) {
        const eventsToPush: ServerEvent[] = [];
        
        for (const e of unsyncedEvents) {
          const contact = contactsStore.contacts.find(c => c.id === e.contact_id);
          const partner = partners.find(p => p.id === contact?.partner_user_id && p.status === 'active');
          
          if (partner) {
            eventsToPush.push({
              clientId: e.id,
              partnershipId: partner.partnershipId,
              type: e.type,
              title: e.title,
              note: e.note,
              intensity: e.intensity,
              mood_tag: e.mood_tag,
              occurred_at: e.occurred_at,
              logged_at: e.logged_at,
            });
          }
        }

        if (eventsToPush.length > 0) {
          await syncApi.push({ events: eventsToPush });
          eventsToPush.forEach(e => {
            eventsStore.editEvent(e.clientId, { synced: 1 });
          });
        }
      }

      // 2. Pull from server
      const res = await syncApi.pull(lastSyncedAt);

      // 3. Update partners list from server and ensure contacts exist
      if (res.partners) {
        set({ partners: res.partners });
        await AsyncStorage.setItem(`${STORAGE_KEY}/partners`, JSON.stringify(res.partners));

        // Proactively create contacts for any new active partners
        const currentContacts = useContactsStore.getState().contacts;
        for (const p of res.partners) {
          if (p.status === 'active' && !currentContacts.some(c => c.partner_user_id === p.id)) {
            useContactsStore.getState().addContact({
              name: p.alias,
              avatar_emoji: '❤️',
              color: '#FF6B6B',
              is_partner: 1,
              partner_user_id: p.id,
            });
          }
        }
      }

      // 4. Process pulled events and ensure contacts exist
      if (res.events.length > 0) {
        // Track contacts locally to avoid duplicates in the same sync loop
        let currentContacts = [...contactsStore.contacts];
        
        for (const se of res.events) {
          // Find or create contact for this partner
          let localContact = currentContacts.find(c => c.partner_user_id === se.partnerId);
          
          if (!localContact) {
            const partnerInfo = res.partners.find(p => p.id === se.partnerId);
            const newContact = await contactsStore.addContact({
              name: partnerInfo?.alias || 'Partner',
              avatar_emoji: '❤️',
              color: '#FF6B6B',
              is_partner: 1,
              partner_user_id: se.partnerId,
            });
            localContact = newContact;
            currentContacts.push(newContact);
          }

          await eventsStore.syncEvent({
            id: se.clientId,
            contact_id: localContact.id,
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
        }
      }

      // 5. Process deletions
      if (res.deletedIds.length > 0) {
        res.deletedIds.forEach((id: string) => {
          eventsStore.removeEvent(id);
        });
      }

      const now = Date.now();
      await AsyncStorage.setItem(`${STORAGE_KEY}/lastSyncedAt`, String(now));
      set({ lastSyncedAt: now, isSyncing: false });

      // 6. Pull pokes received since last check
      const pokeStore = usePokeStore.getState();
      pokeStore.loadPokes(pokeStore.lastPokeCheckedAt).catch(e =>
        console.warn('[SyncStore] Poke poll failed:', e.message)
      );
    } catch (err: any) {
      console.error('Sync failed:', err);
      set({ error: err.message, isSyncing: false });
    }
  },
}));

// Register session expiration handler
onSessionExpired(() => {
  useSyncStore.getState().logout();
});
