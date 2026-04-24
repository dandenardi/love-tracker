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
  loadEvents: (contactId: string) => void;
  logEvent: (payload: Omit<LoveEvent, 'id' | 'logged_at' | 'synced'>) => LoveEvent;
  editEvent: (id: string, patch: Partial<Omit<LoveEvent, 'id'>>) => void;
  removeEvent: (id: string) => void;
  /** Flips the is_private flag on a single event. */
  togglePrivate: (id: string) => void;
  // Selectors (call these with a contactId to get filtered lists)
  getMonthEvents: (contactId: string, year: number, month: number) => LoveEvent[];
  getDayEvents: (contactId: string, dateMs: number) => LoveEvent[];
  syncEvent: (event: LoveEvent) => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],

  loadEvents: (contactId) => {
    const events = getAllEvents(contactId, 200);
    set({ events });
  },

  logEvent: (payload) => {
    const event = createEvent(payload);
    set((s) => ({ events: [event, ...s.events] }));
    return event;
  },

  editEvent: (id, patch) => {
    updateEvent(id, patch);
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  },

  removeEvent: (id) => {
    deleteEvent(id);
    set((s) => ({ events: s.events.filter((e) => e.id !== id) }));
  },

  togglePrivate: (id) => {
    const event = get().events.find((e) => e.id === id);
    if (!event) return;
    const next = event.is_private === 1 ? 0 : 1;
    updateEvent(id, { is_private: next });
    set((s) => ({
      events: s.events.map((e) => (e.id === id ? { ...e, is_private: next } : e)),
    }));
  },

  getMonthEvents: (contactId, year, month) => {
    return getEventsForMonth(contactId, year, month);
  },

  getDayEvents: (contactId, dateMs) => {
    return getEventsByDate(contactId, dateMs);
  },

  syncEvent: (event) => {
    upsertEvent(event);
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
}));
