import { create } from 'zustand';
import {
  createEvent,
  upsertEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEventsForMonth,
  getEventsByDate,
  type LoveEvent,
} from '@/db/events';

interface EventsState {
  events: LoveEvent[];
  // Actions
  loadEvents: (contactId: string) => Promise<void>;
  logEvent: (payload: Omit<LoveEvent, 'id' | 'logged_at' | 'synced'>) => Promise<LoveEvent>;
  editEvent: (id: string, patch: Partial<Omit<LoveEvent, 'id'>>) => Promise<void>;
  removeEvent: (id: string) => Promise<void>;
  /** Flips the is_private flag on a single event. */
  togglePrivate: (id: string) => Promise<void>;
  // Selectors (call these with a contactId to get filtered lists)
  getMonthEvents: (contactId: string, year: number, month: number) => Promise<LoveEvent[]>;
  getDayEvents: (contactId: string, dateMs: number) => Promise<LoveEvent[]>;
  syncEvent: (event: LoveEvent) => Promise<void>;
  markContactEventsAsSynced: (contactId: string) => Promise<void>;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],

  loadEvents: async (contactId) => {
    const events = await getAllEvents(contactId, 200);
    set({ events });
  },

  logEvent: async (payload) => {
    const event = await createEvent(payload);
    set((s) => ({ events: [event, ...s.events] }));
    
    // Trigger background sync
    const { useSyncStore } = require('./useSyncStore');
    useSyncStore.getState().sync().catch(console.error);
    
    return event;
  },

  editEvent: async (id, patch) => {
    const fullPatch = { ...patch, synced: 0 };
    await updateEvent(id, fullPatch);
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...fullPatch } : e)),
    }));

    // Trigger background sync
    const { useSyncStore } = require('./useSyncStore');
    useSyncStore.getState().sync().catch(console.error);
  },

  removeEvent: async (id) => {
    await deleteEvent(id);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));

    // Trigger background sync
    const { useSyncStore } = require('./useSyncStore');
    useSyncStore.getState().sync().catch(console.error);
  },

  togglePrivate: async (id) => {
    const event = get().events.find((e) => e.id === id);
    if (!event) return;
    const next = event.is_private === 1 ? 0 : 1;
    await updateEvent(id, { is_private: next, synced: 0 });
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, is_private: next, synced: 0 } : e)),
    }));

    // Trigger background sync
    const { useSyncStore } = require('./useSyncStore');
    useSyncStore.getState().sync().catch(console.error);
  },

  getMonthEvents: async (contactId, year, month) => {
    return await getEventsForMonth(contactId, year, month);
  },

  getDayEvents: async (contactId, dateMs) => {
    return await getEventsByDate(contactId, dateMs);
  },

  syncEvent: async (event) => {
    await upsertEvent(event);
    set((s) => {
      const exists = s.events.some((e) => e.id === event.id);
      if (exists) {
        return {
          events: s.events.map((e) => (e.id === event.id ? event : e)),
        };
      }
      return {
        events: [event, ...s.events].sort((a, b) => b.occurred_at - a.occurred_at),
      };
    });
  },

  markContactEventsAsSynced: async (contactId) => {
    const { markEventsAsSynced } = require('@/db/events');
    await markEventsAsSynced(contactId);
    set((s) => ({
      events: s.events.map((e) => (e.contact_id === contactId ? { ...e, synced: 1 } : e)),
    }));
  },
}));
