import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from './schema';

export interface Contact {
  id: string;
  name: string;
  nickname?: string;
  avatar_emoji: string;
  color: string;
  is_partner: number; // 0 | 1
  partner_user_id?: string;
  created_at: number;
}

export async function createContact(payload: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
  const db = getDb();
  const contact: Contact = {
    ...payload,
    id: uuidv4(),
    created_at: Date.now(),
  };
  await db.runAsync(
    `INSERT INTO contacts (id, name, nickname, avatar_emoji, color, is_partner, partner_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contact.id,
      contact.name,
      contact.nickname ?? null,
      contact.avatar_emoji,
      contact.color,
      contact.is_partner,
      contact.partner_user_id ?? null,
      contact.created_at,
    ]
  );
  return contact;
}

export async function getAllContacts(): Promise<Contact[]> {
  const db = getDb();
  return await db.getAllAsync<Contact>(
    `SELECT * FROM contacts ORDER BY created_at ASC`
  );
}

export async function getContact(id: string): Promise<Contact | null> {
  const db = getDb();
  return (await db.getFirstAsync<Contact>(`SELECT * FROM contacts WHERE id = ?`, [id])) ?? null;
}

export async function updateContact(id: string, patch: Partial<Omit<Contact, 'id'>>): Promise<void> {
  const db = getDb();
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f] ?? null);
  await db.runAsync(`UPDATE contacts SET ${setClauses} WHERE id = ?`, [...values, id]);
}

export async function deleteContact(id: string): Promise<void> {
  const db = getDb();
  await db.runAsync(`DELETE FROM contacts WHERE id = ?`, [id]);
}
