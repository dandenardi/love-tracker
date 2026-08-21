import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authApi, syncApi, setAccessToken, onSessionExpired, pokeApi } from '@/services/syncApi';
import { storage } from '@/services/storage';
import { getPendingDeletedIds } from '@/db/events';
import { computeContactToken } from '@/services/contactToken';
import { resolveEventSharing } from '@/services/syncPrivacy';
import { Partner, type ServerEvent } from '@/types/shared';
import { useEventsStore } from './useEventsStore';
import { useContactsStore } from './useContactsStore';
import { usePokeStore } from './usePokeStore';
import { useActivityStore } from './useActivityStore';

const STORAGE_KEY = '@love-tracker/sync';

async function loadSyncState() {
  const [userId, alias, partnersJson, lastSyncedAt, pushToken] = await Promise.all([
    AsyncStorage.getItem(`${STORAGE_KEY}/userId`),
    AsyncStorage.getItem(`${STORAGE_KEY}/alias`),
    AsyncStorage.getItem(`${STORAGE_KEY}/partners`),
    AsyncStorage.getItem(`${STORAGE_KEY}/lastSyncedAt`),
    AsyncStorage.getItem(`${STORAGE_KEY}/pushToken`),
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
    pushToken: pushToken || null,
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
  playServicesAvailable: boolean;

  init: () => Promise<void>;
  checkPlayServices: () => Promise<boolean>;
  register: (email: string, password: string, alias: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: () => Promise<void>;
  logout: () => Promise<void>;
  generateInvite: () => Promise<string>;
  pairWithCode: (code: string, contactId?: string, includeHistory?: boolean) => Promise<void>;
  unpair: (partnerId: string) => Promise<void>;
  sync: () => Promise<void>;
  /** Save the Expo push token to state and register it on the server */
  registerPushToken: (token: string) => Promise<void>;
  /** Sync the app's current language to the server, so push notifications use it */
  registerLocale: (locale: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  forgetPartner: (partnerId: string, wipeHistory: boolean) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  userId: null,
  alias: null,
  partners: [],
  lastSyncedAt: 0,
  isSyncing: false,
  error: null,
  pushToken: null,
  playServicesAvailable: true, // Default to true, check in init

  init: async () => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: '232389133756-o6o3u6o5e48rp2ln7d69bbr8om2cbci3.apps.googleusercontent.com',
      offlineAccess: true,
      scopes: ['profile', 'email'],
    });

    if (Platform.OS === 'android') {
      await get().checkPlayServices();
    }

    try {
      const saved = await loadSyncState();
      set(saved);
      const refreshToken = await storage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { accessToken } = await authApi.refresh(refreshToken);
          setAccessToken(accessToken);
        } catch (e) {
          console.error('Failed to refresh token during init:', e);
          // If refresh fails, tokens might be invalid
          await get().logout();
        }
      } else if (saved.userId) {
        // We have a userId but no refresh token? That's inconsistent state.
        console.warn('User ID found without refresh token, logging out.');
        await get().logout();
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

  checkPlayServices: async () => {
    if (Platform.OS !== 'android') return true;
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false });
      set({ playServicesAvailable: true });
      return true;
    } catch (e) {
      console.log('[SyncStore] Play Services not available:', e);
      set({ playServicesAvailable: false });
      return false;
    }
  },

  googleLogin: async () => {
    set({ isSyncing: true, error: null });
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();

      if (userInfo.type === 'cancelled') {
        set({ isSyncing: false });
        return;
      }

      const idToken = userInfo.data?.idToken;
      if (!idToken) {
        throw new Error('Google Sign-In failed: No ID Token returned');
      }

      const res = await authApi.googleLogin(idToken);
      
      await storage.setItem('refreshToken', res.refreshToken);
      setAccessToken(res.accessToken);
      
      await Promise.all([
        AsyncStorage.setItem(`${STORAGE_KEY}/userId`, res.userId),
        AsyncStorage.setItem(`${STORAGE_KEY}/alias`, res.alias),
      ]);
      
      set({ userId: res.userId, alias: res.alias, isSyncing: false });
      await get().sync();
    } catch (err: any) {
      console.error('[SyncStore] Google Login Error:', err);
      // Map common native error codes to friendly messages
      let msg = err.message;
      if (err.code === '10') msg = 'DEVELOPER_ERROR: Check SHA-1 in Google Console.';
      if (err.code === '7') msg = 'NETWORK_ERROR: Please check your connection.';
      if (err.code === '12501') msg = 'Sign-in cancelled by user.';
      
      set({ error: msg, isSyncing: false });
      throw new Error(msg);
    } finally {
      set({ isSyncing: false });
    }
  },

  logout: async () => {
    // 1. Try to clear push token on server (fire and forget)
    if (get().userId) {
      pokeApi.clearPushToken().catch(err => console.warn('[SyncStore] Logout: Failed to clear push token on server:', err.message));
    }

    // 2. Clear local session
    await storage.deleteItem('refreshToken');
    setAccessToken(null);
    await Promise.all([
      AsyncStorage.removeItem(`${STORAGE_KEY}/userId`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/alias`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/partners`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/lastSyncedAt`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/pushToken`),
      AsyncStorage.removeItem(`${STORAGE_KEY}/locale`),
    ]);
    set({ userId: null, alias: null, partners: [], lastSyncedAt: 0, pushToken: null });
  },

  deleteAccount: async () => {
    set({ isSyncing: true });
    try {
      await authApi.deleteAccount();
      await get().logout();
      set({ isSyncing: false });
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  generateInvite: async () => {
    const res = await authApi.invite();
    return res.code;
  },

  registerPushToken: async (token: string) => {
    const currentToken = get().pushToken;
    if (currentToken === token) {
      console.log('[SyncStore] Push token unchanged, skipping registration.');
      return;
    }

    set({ pushToken: token });
    try {
      await AsyncStorage.setItem(`${STORAGE_KEY}/pushToken`, token);
      await pokeApi.savePushToken(token);
      console.log('[SyncStore] Push token registered on server successfully.');
    } catch (err: any) {
      console.error('[SyncStore] Failed to register push token:', err.message);
    }
  },

  registerLocale: async (locale: string) => {
    const lastSynced = await AsyncStorage.getItem(`${STORAGE_KEY}/locale`);
    if (lastSynced === locale) return;

    try {
      await authApi.updateLocale(locale);
      await AsyncStorage.setItem(`${STORAGE_KEY}/locale`, locale);
    } catch (err: any) {
      console.error('[SyncStore] Failed to register locale:', err.message);
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

      // Stale pokes/notifications from the now-dissolved partnership should stop
      // surfacing locally, independent of whatever the server returns going forward.
      await usePokeStore.getState().purgePartner(partnerId);
      await useActivityStore.getState().removeBySender(partnerId);
    } catch (err: any) {
      set({ error: err.message, isSyncing: false });
      throw err;
    }
  },

  forgetPartner: async (partnerId, wipeHistory) => {
    set({ isSyncing: true, error: null });
    try {
      if (wipeHistory) {
        const contact = useContactsStore.getState().contacts.find(c => c.partner_user_id === partnerId);
        if (contact) {
          await useContactsStore.getState().removeContact(contact.id);
          console.log(`[SyncStore] Local history wiped for partner: ${partnerId}`);
        }
      }

      await authApi.forgetPartner(partnerId);
      
      const partners = get().partners.filter(p => p.id !== partnerId);
      await AsyncStorage.setItem(`${STORAGE_KEY}/partners`, JSON.stringify(partners));
      set({ partners, isSyncing: false });

      await usePokeStore.getState().purgePartner(partnerId);
      await useActivityStore.getState().removeBySender(partnerId);

      console.log(`[SyncStore] Partner forgotten: ${partnerId}`);
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
      
      const unsyncedEvents = eventsStore.events.filter(e => e.synced === 0);

      // 0. Push pending local deletions (tombstones not yet confirmed by the server). These
      // live only in SQLite, not in-memory `events` (removeEvent already filters them out of
      // state), so they're fetched separately. A failed delete just leaves its tombstone in
      // place for the next sync attempt — never abort the whole sync over one failed delete.
      // See specs/005-deletion-sync/spec.md.
      const pendingDeletedIds = await getPendingDeletedIds();
      for (const id of pendingDeletedIds) {
        try {
          await syncApi.delete(id);
          await eventsStore.applyRemoteDeletion(id);
        } catch (err) {
          console.error('[SyncStore] Failed to push deletion for', id, err);
        }
      }

      // 1. Group events by partner and push. Anything that isn't a non-private event with a
      // resolvable active partner is backed up as an own-only event instead (partnershipId:
      // null) — never dropped silently. See specs/004-private-event-backup-sync/spec.md.
      if (unsyncedEvents.length > 0) {
        const eventsToPush: ServerEvent[] = [];

        for (const e of unsyncedEvents) {
          const contact = contactsStore.contacts.find(c => c.id === e.contact_id);
          const partner = partners.find(p => p.id === contact?.partner_user_id && p.status === 'active');
          const { partnershipId } = resolveEventSharing(partner, e.is_private);

          // Casual (non-partner) contacts get an opaque grouping tag so solo AI Insights can
          // detect person-specific patterns without the server ever learning contact identity.
          // See specs/006-pseudonymous-contact-tokens.
          const contactToken = contact && contact.is_partner === 0
            ? await computeContactToken(contact.id)
            : undefined;

          eventsToPush.push({
            clientId: e.id,
            partnershipId,
            is_private: e.is_private,
            contactToken,
            type: e.type,
            title: e.title,
            note: e.note,
            intensity: e.intensity,
            mood_tag: e.mood_tag,
            occurred_at: e.occurred_at,
            logged_at: e.logged_at,
          });
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
        // We'll reload contacts first to be sure we have the latest
        await contactsStore.loadContacts();
        const currentContacts = useContactsStore.getState().contacts;
        
        for (const p of res.partners) {
          if (p.status === 'active' && !currentContacts.some(c => c.partner_user_id === p.id)) {
            console.log(`[SyncStore] Creating contact for new partner: ${p.alias}`);
            await useContactsStore.getState().addContact({
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
        // Re-fetch contacts after proactive creation to avoid duplicates in the events loop
        await contactsStore.loadContacts();
        let currentContacts = [...useContactsStore.getState().contacts];
        
        for (const se of res.events) {
          // Find or create contact for this partner
          let localContact = currentContacts.find(c => c.partner_user_id === se.partnerId);
          
          if (!localContact) {
            console.log(`[SyncStore] Contact not found for partner ${se.partnerId} during event sync. Creating...`);
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

          // Log partner activity
          const partnerInfo = res.partners.find(p => p.id === se.partnerId);
          useActivityStore.getState().addActivity({
            id: `sync-${se.clientId}`,
            type: 'event_added',
            title: partnerInfo?.alias || 'Partner',
            body: se.type,
            timestamp: se.occurred_at,
            data: { clientId: se.clientId, type: se.type },
          }).catch(console.error);
        }
      }

      // 4b. Merge this user's own backup events (private/unlinked, and own shared-authored
      // events on device restore). Always contact_id: null — restoring a private couple event's
      // original Contact link isn't attempted (see specs/004-private-event-backup-sync/spec.md,
      // Out of Scope). upsertEvent's ON CONFLICT clause never overwrites contact_id/is_private
      // on an existing local row, so this is safe to run every sync even when nothing changed.
      if (res.ownEvents?.length > 0) {
        for (const oe of res.ownEvents) {
          await eventsStore.syncEvent({
            id: oe.clientId,
            contact_id: null,
            type: oe.type,
            title: oe.title,
            note: oe.note,
            intensity: oe.intensity,
            mood_tag: oe.mood_tag,
            occurred_at: oe.occurred_at,
            logged_at: oe.logged_at,
            synced: 1,
            is_private: oe.is_private,
          });
        }
      }

      // 5. Process deletions. Always applyRemoteDeletion (hard purge, no outbound push) here —
      // these are already confirmed server-side; using removeEvent would incorrectly create a
      // new local tombstone and attempt to re-push a delete for an id outside this user's own
      // client_id namespace. See specs/005-deletion-sync/spec.md.
      if (res.deletedIds.length > 0) {
        for (const id of res.deletedIds) {
          await eventsStore.applyRemoteDeletion(id);
        }
      }

      // 5b. Process this user's own deletions arriving from another of their devices.
      if (res.ownDeletedIds?.length > 0) {
        for (const id of res.ownDeletedIds) {
          await eventsStore.applyRemoteDeletion(id);
        }
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
