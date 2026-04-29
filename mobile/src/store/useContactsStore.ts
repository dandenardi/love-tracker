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
  addContact: (payload: Omit<Contact, 'id' | 'created_at'>) => Contact;
  editContact: (id: string, patch: Partial<Omit<Contact, 'id'>>) => void;
  removeContact: (id: string) => void;
  setActiveContact: (id: string) => void;
  activeContact: () => Contact | null;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  activeContactId: null,

  loadContacts: async () => {
    const contacts = getAllContacts();
    const stored = await AsyncStorage.getItem(ACTIVE_CONTACT_KEY);
    const activeContactId =
      stored && contacts.find((c) => c.id === stored)
        ? stored
        : contacts[0]?.id ?? null;
    if (activeContactId) await AsyncStorage.setItem(ACTIVE_CONTACT_KEY, activeContactId);
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
}));
