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
const SOLO_MODE_KEY = '@love-tracker/soloModeActive';

interface ContactsState {
  contacts: Contact[];
  activeContactId: string | null;
  /** True when the user is logging/viewing unlinked solo diary entries instead of a Contact. */
  soloModeActive: boolean;
  loadContacts: () => Promise<void>;
  addContact: (payload: Omit<Contact, 'id' | 'created_at'>) => Promise<Contact>;
  editContact: (id: string, patch: Partial<Omit<Contact, 'id'>>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  setActiveContact: (id: string) => void;
  setSoloMode: (active: boolean) => void;
  /** Resolves the contact_id to use for reads/writes: null while solo mode is active. */
  getEffectiveContactId: () => string | null;
  activeContact: () => Contact | null;
  getContactByPartnerId: (partnerId: string) => Contact | undefined;
  cleanupDuplicates: () => Promise<void>;
}

export const useContactsStore = create<ContactsState>((set, get) => ({
  contacts: [],
  activeContactId: null,
  soloModeActive: false,

  loadContacts: async () => {
    const contacts = await getAllContacts();
    const stored = await AsyncStorage.getItem(ACTIVE_CONTACT_KEY);
    const activeContactId =
      stored && contacts.find((c) => c.id === stored)
        ? stored
        : contacts[0]?.id ?? null;
    if (activeContactId) await AsyncStorage.setItem(ACTIVE_CONTACT_KEY, activeContactId);
    const soloModeActive = (await AsyncStorage.getItem(SOLO_MODE_KEY)) === '1';
    set({ contacts, activeContactId, soloModeActive });

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
    AsyncStorage.setItem(SOLO_MODE_KEY, '0');
    set({ activeContactId: id, soloModeActive: false });
  },

  setSoloMode: (active) => {
    AsyncStorage.setItem(SOLO_MODE_KEY, active ? '1' : '0');
    set({ soloModeActive: active });
  },

  getEffectiveContactId: () => {
    const { soloModeActive, activeContactId } = get();
    return soloModeActive ? null : activeContactId;
  },

  activeContact: () => {
    const { contacts, activeContactId } = get();
    return contacts.find((c) => c.id === activeContactId) ?? null;
  },
  
  getContactByPartnerId: (partnerId: string) => {
    return get().contacts.find(c => c.partner_user_id === partnerId);
  },

  cleanupDuplicates: async () => {
    const { contacts } = get();
    // Consider both partner_user_id and is_partner flag
    const partners = contacts.filter(c => c.partner_user_id || c.is_partner === 1);
    if (partners.length < 2) return;

    const seenByUserId = new Map<string, Contact>();
    const seenByName = new Map<string, Contact>();
    const toRemove: string[] = [];
    const merges: { from: string, to: string }[] = [];

    for (const p of partners) {
      const pid = p.partner_user_id;
      const name = p.name.toLowerCase().trim();
      
      let master: Contact | undefined;
      
      if (pid && seenByUserId.has(pid)) {
        master = seenByUserId.get(pid);
      } else if (seenByName.has(name) && (!pid || !seenByName.get(name)?.partner_user_id)) {
        // If names match and we haven't found a better match by ID yet
        master = seenByName.get(name);
      }

      if (master && master.id !== p.id) {
        toRemove.push(p.id);
        merges.push({ from: p.id, to: master.id });
        
        // If the duplicate has a partner_user_id but the master doesn't, update the master
        if (p.partner_user_id && !master.partner_user_id) {
           master.partner_user_id = p.partner_user_id;
           await updateContact(master.id, { partner_user_id: p.partner_user_id });
        }
      } else {
        if (pid) seenByUserId.set(pid, p);
        seenByName.set(name, p);
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
