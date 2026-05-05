import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pokeApi } from '@/services/syncApi';
import {
  PokeMessage,
  DEFAULT_SLOTS,
  POKE_MESSAGES,
  registerPokeCategory,
  schedulePokeNotification,
  PokeNotificationContext,
} from '@/services/notificationService';
import { Poke } from '@/types/shared';

// ─────────────────────────────────────────────────────────────────────────────
// AsyncStorage persistence for slot preferences
// ─────────────────────────────────────────────────────────────────────────────

const SLOTS_KEY = '@love-tracker/poke_slots';

function loadSlotsFromStorage(): [PokeMessage, PokeMessage, PokeMessage] {
  // Synchronous load not possible with AsyncStorage — return defaults.
  // The actual load happens asynchronously in loadSlotsAsync().
  return DEFAULT_SLOTS;
}

async function loadSlotsAsync(): Promise<[PokeMessage, PokeMessage, PokeMessage]> {
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

async function saveSlotsToStorage(slots: [PokeMessage, PokeMessage, PokeMessage]): Promise<void> {
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

  isSending: boolean;
  lastError: string | null;

  /** Load pokes received since the given timestamp */
  loadPokes: (since: number) => Promise<void>;

  /**
   * Send a poke to a partner.
   * `messageKey` is the i18n key (e.g. 'thinking'), resolved to a label by the caller.
   */
  sendPoke: (partnerId: string, messageKey: string, emoji: string) => Promise<void>;

  /**
   * Update the 3 active slots. Persists to AsyncStorage and refreshes the
   * notification category + notification in the tray.
   */
  setSlots: (
    slots: [PokeMessage, PokeMessage, PokeMessage],
    context: PokeNotificationContext,
    titleText: string,
    bodyText: string,
    getLabel: (key: string) => string
  ) => Promise<void>;

  /** Mark a poke as read on the server */
  markRead: (pokeId: string) => Promise<void>;
}

export const usePokeStore = create<PokeState>((set, get) => ({
  receivedPokes: [],
  lastPokeCheckedAt: 0,
  slots: DEFAULT_SLOTS,  // will be hydrated by loadSlotsAsync in init
  allMessages: POKE_MESSAGES,
  isSending: false,
  lastError: null,

  loadPokes: async (since: number) => {
    // Hydrate slots from AsyncStorage on first call if still defaults
    const currentSlots = get().slots;
    if (JSON.stringify(currentSlots) === JSON.stringify(DEFAULT_SLOTS)) {
      const storedSlots = await loadSlotsAsync();
      set({ slots: storedSlots });
    }

    try {
      const res = await pokeApi.list(since);
      set(state => {
        // Merge new pokes with existing ones (avoid duplicates by id)
        const existingIds = new Set(state.receivedPokes.map(p => p.id));
        const newPokes = res.pokes.filter(p => !existingIds.has(p.id));
        return {
          receivedPokes: [...newPokes, ...state.receivedPokes],
          lastPokeCheckedAt: Date.now(),
        };
      });
    } catch (err: any) {
      console.error('[PokeStore] Failed to load pokes:', err.message);
    }
  },

  sendPoke: async (partnerId: string, messageKey: string, emoji: string) => {
    set({ isSending: true, lastError: null });
    try {
      await pokeApi.send({ partnerId, message: messageKey, emoji });
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
    try {
      await registerPokeCategory(slots, getLabel);
      await schedulePokeNotification({ ...context, slots }, titleText, bodyText);
    } catch (err: any) {
      console.error('[PokeStore] Failed to refresh poke notification:', err.message);
    }
  },

  markRead: async (pokeId: string) => {
    try {
      await pokeApi.markRead(pokeId);
      set(state => ({
        receivedPokes: state.receivedPokes.map(p =>
          p.id === pokeId ? { ...p, readAt: Date.now() } : p
        ),
      }));
    } catch (err: any) {
      console.error('[PokeStore] Failed to mark poke as read:', err.message);
    }
  },
}));
