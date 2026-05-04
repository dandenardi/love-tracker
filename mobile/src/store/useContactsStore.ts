import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAllContacts,
  createContact,
  updateContact,
  deleteContact,
  type Contact,
} from '@/db/contacts';

const ACTIVE_CONTACT_KEY = '@love-tracker/activeContactId';

interface ContactsState {
  contacts: Contact[];
  activeContactId: string | null;
  loadContacts: () => Promise<void>;
  addContact: (payload: Omit<Contact, 'id' | 'created_at'>) => Promise<Contact>;
  editContact: (id: string, patch: Partial<Omit<Contact, 'id'>>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  setActiveContact: (id: string) => void;
  activeContact: () => Contact | null;
  cleanupDuplicates: () => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  activeContactId: null,

  loadContacts: async () => {
    const contacts = await getAllContacts();
    const stored = await AsyncStorage.getItem(ACTIVE_CONTACT_KEY);
    const activeContactId =
      stored && contacts.find((c) => c.id === stored)
        ? stored
        : contacts[0]?.id ?? null;
    if (activeContactId) await AsyncStorage.setItem(ACTIVE_CONTACT_KEY, activeContactId);
    set({ contacts, activeContactId });
    
    // Run cleanup in background if there are contacts
    if (contacts.length > 1) {
      get().cleanupDuplicates().catch(console.error);
    }
  },

  addContact: async (payload) => {
    const contact = await createContact(payload);
    set((s) => ({ contacts: [...s.contacts, contact] }));
    return contact;
  },

  editContact: async (id, patch) => {
    await updateContact(id, patch);
    set((s) => ({
      contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  removeContact: async (id) => {
    await deleteContact(id);
    set((s) => {
      const contacts = s.contacts.filter((c) => c.id !== id);
      const activeContactId =
        s.activeContactId === id ? (contacts[0]?.id ?? null) : s.activeContactId;
      if (activeContactId) AsyncStorage.setItem(ACTIVE_CONTACT_KEY, activeContactId);
      return { contacts, activeContactId };
    });
  },

  setActiveContact: (id) => {
    AsyncStorage.setItem(ACTIVE_CONTACT_KEY, id);
    set({ activeContactId: id });
  },

  activeContact: () => {
    const { contacts, activeContactId } = get();
    return contacts.find((c) => c.id === activeContactId) ?? null;
  },

  cleanupDuplicates: async () => {
    const { contacts } = get();
    const partners = contacts.filter(c => c.partner_user_id);
    if (partners.length < 2) return;

    const seen = new Map<string, Contact>();
    const toRemove: string[] = [];
    const merges: { from: string, to: string }[] = [];

    for (const p of partners) {
      const pid = p.partner_user_id!;
      if (seen.has(pid)) {
        const master = seen.get(pid)!;
        toRemove.push(p.id);
        merges.push({ from: p.id, to: master.id });
      } else {
        seen.set(pid, p);
      }
    }

    if (toRemove.length === 0) return;

    console.log(`[ContactsStore] Found ${toRemove.length} duplicate partner contacts. Merging...`);

    const { getDb } = require('@/db/schema');
    const db = getDb();

    // 1. Update events to point to master contact
    for (const merge of merges) {
      await db.runAsync('UPDATE events SET contact_id = ? WHERE contact_id = ?', [merge.to, merge.from]);
    }

    // 2. Delete duplicate contacts
    for (const id of toRemove) {
      await db.runAsync('DELETE FROM contacts WHERE id = ?', [id]);
    }

    // 3. Reload everything
    const updatedContacts = await getAllContacts();
    set({ contacts: updatedContacts });
    
    // Refresh events store too since contact_ids changed
    const { useEventsStore } = require('./useEventsStore');
    const activeContactId = get().activeContactId;
    if (activeContactId) {
       useEventsStore.getState().loadEvents(activeContactId);
    }
  },
}));
