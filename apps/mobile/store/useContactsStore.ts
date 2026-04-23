import { create } from 'zustand';
import {
  getAllContacts,
  createContact,
  updateContact,
  deleteContact,
  type Contact,
} from '@/db/contacts';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'love-tracker-prefs' });
const ACTIVE_CONTACT_KEY = 'activeContactId';

interface ContactsState {
  contacts: Contact[];
  activeContactId: string | null;
  // Actions
  loadContacts: () => void;
  addContact: (payload: Omit<Contact, 'id' | 'created_at'>) => Contact;
  editContact: (id: string, patch: Partial<Omit<Contact, 'id'>>) => void;
  removeContact: (id: string) => void;
  setActiveContact: (id: string) => void;
  activeContact: () => Contact | null;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  activeContactId: storage.getString(ACTIVE_CONTACT_KEY) ?? null,

  loadContacts: () => {
    const contacts = getAllContacts();
    const stored = storage.getString(ACTIVE_CONTACT_KEY);
    const activeContactId =
      stored && contacts.find((c) => c.id === stored)
        ? stored
        : contacts[0]?.id ?? null;
    if (activeContactId) storage.set(ACTIVE_CONTACT_KEY, activeContactId);
    set({ contacts, activeContactId });
  },

  addContact: (payload) => {
    const contact = createContact(payload);
    set((s) => ({ contacts: [...s.contacts, contact] }));
    return contact;
  },

  editContact: (id, patch) => {
    updateContact(id, patch);
    set((s) => ({
      contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  },

  removeContact: (id) => {
    deleteContact(id);
    set((s) => {
      const contacts = s.contacts.filter((c) => c.id !== id);
      const activeContactId =
        s.activeContactId === id ? (contacts[0]?.id ?? null) : s.activeContactId;
      if (activeContactId) storage.set(ACTIVE_CONTACT_KEY, activeContactId);
      return { contacts, activeContactId };
    });
  },

  setActiveContact: (id) => {
    storage.set(ACTIVE_CONTACT_KEY, id);
    set({ activeContactId: id });
  },

  activeContact: () => {
    const { contacts, activeContactId } = get();
    return contacts.find((c) => c.id === activeContactId) ?? null;
  },
}));
