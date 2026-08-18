import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@love-tracker/activities';

export type ActivityType = 'poke' | 'event_added' | 'system';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  body: string;
  timestamp: number;
  readAt: number | null; // Notification inbox status
  pokeReadAt?: number | null; // Partner read status
  pokeDeliveredAt?: number | null; // Partner delivery status
  senderId?: string;
  data?: any;
}

interface ActivityState {
  activities: Activity[];
  isLoaded: boolean;

  addActivity: (activity: Omit<Activity, 'readAt'> & { readAt?: number | null }) => Promise<void>;
  updateActivity: (id: string, updates: Partial<Activity>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  loadActivities: () => Promise<void>;
  /** Purge cached activities from a given sender (e.g. an ex-partner after unpair) */
  removeBySender: (senderId: string) => Promise<void>;
}

export const useActivityStore = create<ActivityState>((set, get) => ({
  activities: [],
  isLoaded: false,

  loadActivities: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded: Activity[] = JSON.parse(raw);
        // Remove duplicates and entries without ID
        const valid = loaded.filter(a => a && a.id);
        const unique = valid.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
        set({ activities: unique, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (err) {
      console.error('[ActivityStore] Failed to load:', err);
      set({ isLoaded: true });
    }
  },

  addActivity: async (activity) => {
    if (!get().isLoaded) await get().loadActivities();

    // Avoid duplicates by ID
    if (get().activities.some(a => a.id === activity.id)) {
      console.log('[ActivityStore] Activity already exists, skipping:', activity.id);
      return;
    }

    console.log('[ActivityStore] Adding new activity:', activity.type, activity.id);

    // Use current time as fallback if timestamp is missing or invalid
    let dateObj = new Date(activity.timestamp || Date.now());
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date();
    }
    
    const timestamp = dateObj.getTime();

    const newActivity: Activity = {
      ...activity,
      timestamp,
      readAt: activity.readAt ?? null,
      pokeReadAt: activity.pokeReadAt || null,
      pokeDeliveredAt: activity.pokeDeliveredAt || null
    };
    const updated = [newActivity, ...get().activities].slice(0, 100);

    set({ activities: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log('[ActivityStore] Saved to storage, count:', updated.length);
  },

  updateActivity: async (id, updates) => {
    const updated = get().activities.map(a =>
      a.id === id ? { ...a, ...updates } : a
    );
    set({ activities: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  markAsRead: async (id) => {
    const updated = get().activities.map(a =>
      a.id === id ? { ...a, readAt: Date.now() } : a
    );
    set({ activities: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  markAllAsRead: async () => {
    const now = Date.now();
    const updated = get().activities.map(a => ({ ...a, readAt: a.readAt || now }));
    set({ activities: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },

  clearAll: async () => {
    set({ activities: [] });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  removeBySender: async (senderId) => {
    const updated = get().activities.filter(a => a.senderId !== senderId);
    set({ activities: updated });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  },
}));
