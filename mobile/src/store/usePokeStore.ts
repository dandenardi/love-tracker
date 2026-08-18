import {
  DEFAULT_SLOTS,
  POKE_MESSAGES,
  PokeMessage,
  PokeNotificationContext,
  registerPokeCategory,
  schedulePokeNotification,
} from "@/services/notificationService";
import { pokeApi } from "@/services/syncApi";
import { Poke } from "@/types/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { create } from "zustand";
import { useActivityStore } from "./useActivityStore";

// ─────────────────────────────────────────────────────────────────────────────
// AsyncStorage persistence for slot preferences
// ─────────────────────────────────────────────────────────────────────────────

const SLOTS_KEY = "@love-tracker/poke_slots";
const CUSTOM_POKES_KEY = "@love-tracker/custom_pokes";
const POKES_KEY = "@love-tracker/received_pokes";
const LAST_CHECK_KEY = "@love-tracker/last_poke_check";

function loadSlotsFromStorage(): [PokeMessage, PokeMessage, PokeMessage] {
  // Synchronous load not possible with AsyncStorage — return defaults.
  // The actual load happens asynchronously in loadSlotsAsync().
  return DEFAULT_SLOTS;
}

async function loadSlotsAsync(): Promise<
  [PokeMessage, PokeMessage, PokeMessage]
> {
  try {
    const raw = await AsyncStorage.getItem(SLOTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PokeMessage[];
      if (Array.isArray(parsed) && parsed.length === 3) {
        return parsed as [PokeMessage, PokeMessage, PokeMessage];
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SLOTS;
}

async function saveSlotsToStorage(
  slots: [PokeMessage, PokeMessage, PokeMessage],
): Promise<void> {
  await AsyncStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export interface PokeState {
  /** Pokes received by this user (shown inside the app) */
  receivedPokes: Poke[];
  lastPokeCheckedAt: number;

  /** The 3 active slots shown as notification action buttons */
  slots: [PokeMessage, PokeMessage, PokeMessage];

  /** All available poke messages (for the picker) */
  allMessages: PokeMessage[];

  /** User-created custom poke messages, persisted across sessions */
  savedCustomPokes: PokeMessage[];

  isSending: boolean;
  isHydrated: boolean;
  lastError: string | null;

  /** Load pokes received since the given timestamp */
  loadPokes: (since: number) => Promise<void>;

  /** Send a poke to a partner using the given slot (preset or custom). */
  sendPoke: (
    partnerId: string,
    slot: PokeMessage,
  ) => Promise<void>;

  /**
   * Update the 3 active slots. Persists to AsyncStorage and refreshes the
   * notification category + notification in the tray.
   */
  setSlots: (
    slots: [PokeMessage, PokeMessage, PokeMessage],
    context: PokeNotificationContext,
    titleText: string,
    bodyText: string,
    getLabel: (msg: PokeMessage) => string,
  ) => Promise<void>;

  /** Persist a new custom poke to the saved list. Deduplicates by label. */
  addCustomPoke: (msg: PokeMessage) => Promise<void>;

  /** Remove a custom poke from the saved list. */
  removeCustomPoke: (msg: PokeMessage) => Promise<void>;

  /** Mark a poke as read on the server */
  markRead: (pokeId: string) => Promise<void>;

  /** Mark a poke as delivered on the server */
  markDelivered: (pokeId: string) => Promise<void>;

  /** Purge cached pokes received from a given partner (e.g. an ex-partner after unpair) */
  purgePartner: (partnerId: string) => Promise<void>;
}

export const usePokeStore = create<PokeState>((set, get) => ({
  receivedPokes: [],
  lastPokeCheckedAt: 0,
  slots: DEFAULT_SLOTS, // will be hydrated by loadSlotsAsync in init
  allMessages: POKE_MESSAGES,
  savedCustomPokes: [],
  isSending: false,
  isHydrated: false,
  lastError: null,

  loadPokes: async (since: number) => {
    // 1. Hydrate state on first call
    if (!get().isHydrated) {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const POKES_KEY = "@love-tracker/received_pokes";
      const LAST_CHECK_KEY = "@love-tracker/last_poke_check";
      try {
        const [savedPokes, savedCheck, storedSlots, rawCustom] = await Promise.all([
          AsyncStorage.getItem(POKES_KEY),
          AsyncStorage.getItem(LAST_CHECK_KEY),
          loadSlotsAsync(),
          AsyncStorage.getItem(CUSTOM_POKES_KEY),
        ]);
        const updates: Partial<PokeState> = { slots: storedSlots, isHydrated: true };
        if (savedPokes) updates.receivedPokes = JSON.parse(savedPokes);
        if (savedCheck) updates.lastPokeCheckedAt = parseInt(savedCheck, 10);
        if (rawCustom) updates.savedCustomPokes = JSON.parse(rawCustom);
        set(updates);
      } catch (e) {
        console.warn("[PokeStore] Hydration failed:", e);
        set({ isHydrated: true });
      }
    }

    const lookBackWindow = 48 * 60 * 60 * 1000;
    const now = Date.now();
    let effectiveSince = Math.max(0, get().lastPokeCheckedAt - lookBackWindow);
    
    if (effectiveSince > now) {
      console.warn('[PokeStore] Clock inconsistency detected. Resetting since.');
      effectiveSince = now - lookBackWindow;
    }

    try {
      const res = await pokeApi.list(effectiveSince);
      const { userId } = require('./useSyncStore').useSyncStore.getState();
      const i18n = require('@/i18n').default;
      const t = i18n.t.bind(i18n);
      const activityStore = useActivityStore.getState();
      const eventsStore = require('./useEventsStore').useEventsStore.getState();
      const contactsStore = require('./useContactsStore').useContactsStore.getState();

      const existingPokes = [...get().receivedPokes];
      let maxSentAt = get().lastPokeCheckedAt;

      for (const incoming of res.pokes) {
        if (incoming.sentAt > maxSentAt) maxSentAt = incoming.sentAt;

        const existingIdx = existingPokes.findIndex(p => p.id === incoming.id);
        const msg = POKE_MESSAGES.find((m) => m.key === incoming.message);
        const translatedMsg = msg ? t(`poke.messages.${msg.key}`) : incoming.message;
        const displayMsg = msg ? `${msg.emoji} ${translatedMsg}` : `${incoming.emoji} ${incoming.message}`;

        if (existingIdx !== -1) {
          // Status Reconciliation
          const existing = existingPokes[existingIdx];
          if (incoming.readAt !== existing.readAt || incoming.deliveredAt !== existing.deliveredAt) {
            console.log(`[PokeStore] Reconciling status for ${incoming.id}`);
            existingPokes[existingIdx] = { ...existing, ...incoming };
            
            activityStore.updateActivity(incoming.id, {
              pokeReadAt: incoming.readAt || null,
              pokeDeliveredAt: incoming.deliveredAt || null
            }).catch(() => {});

            const contact = contactsStore.getContactByPartnerId(incoming.senderId);
            if (contact) {
              eventsStore.updateEventStatus(incoming.id, {
                read_at: incoming.readAt || undefined,
                delivered_at: incoming.deliveredAt || undefined
              }).catch(() => {});
            }
          }
        } else {
          // New Poke
          existingPokes.push(incoming);

          if (incoming.senderId !== userId && !incoming.deliveredAt) {
            get().markDelivered(incoming.id).catch(console.error);
          }

          activityStore.addActivity({
            id: incoming.id,
            type: "poke",
            title: incoming.senderAlias,
            body: displayMsg,
            timestamp: incoming.sentAt,
            // Reconstructing this poke after a local cache eviction shouldn't reset it to
            // unread if the recipient already read it (on this or another device/session) —
            // honor the server's own read_at instead of assuming it's brand new.
            readAt: incoming.readAt || null,
            pokeReadAt: incoming.readAt || null,
            pokeDeliveredAt: incoming.deliveredAt || null,
            senderId: incoming.senderId,
            data: { pokeId: incoming.id },
          }).catch(console.error);

          const contact = contactsStore.getContactByPartnerId(incoming.senderId);
          if (contact) {
            eventsStore.syncEvent({
              id: incoming.id,
              contact_id: contact.id,
              type: 'POKE',
              title: incoming.senderAlias,
              note: displayMsg,
              intensity: 0,
              occurred_at: incoming.sentAt,
              logged_at: Date.now(),
              synced: 1,
              is_private: 0,
              delivered_at: incoming.deliveredAt || null,
              read_at: incoming.readAt || null,
            }).catch(console.error);
          }
        }
      }

      // Update State and Storage
      const updatedCheck = Math.max(maxSentAt, get().lastPokeCheckedAt);
      const finalPokes = existingPokes.slice(-100);

      set({
        receivedPokes: finalPokes,
        lastPokeCheckedAt: updatedCheck,
      });

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const POKES_KEY = "@love-tracker/received_pokes";
      const LAST_CHECK_KEY = "@love-tracker/last_poke_check";
      
      AsyncStorage.setItem(POKES_KEY, JSON.stringify(finalPokes)).catch(() => {});
      AsyncStorage.setItem(LAST_CHECK_KEY, String(updatedCheck)).catch(() => {});

    } catch (err: any) {
      console.error("[PokeStore] Failed to load pokes:", err.message);
    }
  },

  sendPoke: async (partnerId: string, slot: PokeMessage) => {
    set({ isSending: true, lastError: null });
    try {
      const message = slot.customLabel ?? slot.key;
      const res = await pokeApi.send({ partnerId, message, emoji: slot.emoji });

      const { userId } = require('./useSyncStore').useSyncStore.getState();
      const i18n = require('@/i18n').default;
      const t = i18n.t.bind(i18n);
      const label = slot.customLabel ?? t(`poke.messages.${slot.key}`);
      const displayMsg = `${slot.emoji} ${label}`;

      useActivityStore.getState().addActivity({
        id: res.id,
        type: 'poke',
        title: t('notifications.pokeSentTitle'),
        body: displayMsg,
        timestamp: Date.now(),
        senderId: userId,
        data: { pokeId: res.id },
      }).catch(console.error);

      const contactsStore = require('./useContactsStore').useContactsStore.getState();
      const contact = contactsStore.getContactByPartnerId(partnerId);
      if (contact) {
        const eventsStore = require('./useEventsStore').useEventsStore.getState();
        eventsStore.syncEvent({
          id: res.id,
          contact_id: contact.id,
          type: 'POKE',
          title: t('notifications.pokeSentTitle'),
          note: displayMsg,
          intensity: 0,
          occurred_at: Date.now(),
          logged_at: Date.now(),
          synced: 1,
          is_private: 0,
        }).catch(console.error);
      }

      set({ isSending: false });
    } catch (err: any) {
      set({ isSending: false, lastError: err.message });
      throw err;
    }
  },

  setSlots: async (slots, context, titleText, bodyText, getLabel) => {
    await saveSlotsToStorage(slots);
    set({ slots });

    // Re-register the notification category and refresh the persistent notification
    if (Platform.OS === 'web') return;

    try {
      await registerPokeCategory(slots, getLabel);
      await schedulePokeNotification(
        { ...context, slots },
        titleText,
        bodyText,
      );
    } catch (err: any) {
      console.error(
        "[PokeStore] Failed to refresh poke notification:",
        err.message,
      );
    }
  },

  addCustomPoke: async (msg: PokeMessage) => {
    const current = get().savedCustomPokes;
    // Deduplicate by customLabel — replace if the same label exists (emoji may have changed)
    const filtered = current.filter(p => p.customLabel !== msg.customLabel);
    const updated = [...filtered, msg];
    set({ savedCustomPokes: updated });
    await AsyncStorage.setItem(CUSTOM_POKES_KEY, JSON.stringify(updated));
  },

  removeCustomPoke: async (msg: PokeMessage) => {
    const updated = get().savedCustomPokes.filter(p => p.customLabel !== msg.customLabel);
    set({ savedCustomPokes: updated });
    await AsyncStorage.setItem(CUSTOM_POKES_KEY, JSON.stringify(updated));
  },

  markRead: async (pokeId: string) => {
    try {
      await pokeApi.markRead(pokeId);
      set((state) => ({
        receivedPokes: state.receivedPokes.map((p) =>
          p.id === pokeId ? { ...p, readAt: Date.now(), deliveredAt: p.deliveredAt || Date.now() } : p,
        ),
      }));
      // Update activity store too
      useActivityStore.getState().updateActivity(pokeId, { 
        pokeReadAt: Date.now(), 
        pokeDeliveredAt: Date.now() 
      }).catch(console.error);
      // Update SQLite
      const eventsStore = require('./useEventsStore').useEventsStore.getState();
      eventsStore.updateEventStatus(pokeId, {
        read_at: Date.now(),
        delivered_at: Date.now()
      }).catch(console.error);
    } catch (err: any) {
      console.error("[PokeStore] Failed to mark poke as read:", err.message);
    }
  },

  markDelivered: async (pokeId: string) => {
    try {
      await pokeApi.markDelivered(pokeId);
      set((state) => ({
        receivedPokes: state.receivedPokes.map((p) =>
          p.id === pokeId ? { ...p, deliveredAt: Date.now() } : p,
        ),
      }));
      // Update activity store too
      useActivityStore.getState().updateActivity(pokeId, { pokeDeliveredAt: Date.now() }).catch(console.error);
      // Update SQLite
      const eventsStore = require('./useEventsStore').useEventsStore.getState();
      eventsStore.updateEventStatus(pokeId, { delivered_at: Date.now() }).catch(console.error);
    } catch (err: any) {
      console.error("[PokeStore] Failed to mark poke as delivered:", err.message);
    }
  },

  purgePartner: async (partnerId: string) => {
    const finalPokes = get().receivedPokes.filter((p) => p.senderId !== partnerId);
    set({ receivedPokes: finalPokes });
    await AsyncStorage.setItem(POKES_KEY, JSON.stringify(finalPokes));
  },
}));
