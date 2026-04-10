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

export function createContact(payload: Omit<Contact, 'id' | 'created_at'>): Contact {
  const db = getDb();
  const contact: Contact = {
    ...payload,
    id: uuidv4(),
    created_at: Date.now(),
  };
  db.runSync(
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

export function getAllContacts(): Contact[] {
  const db = getDb();
  return db.getAllSync<Contact>(
    `SELECT * FROM contacts ORDER BY created_at ASC`
  );
}

export function getContact(id: string): Contact | null {
  const db = getDb();
  return db.getFirstSync<Contact>(`SELECT * FROM contacts WHERE id = ?`, [id]) ?? null;
}

export function updateContact(id: string, patch: Partial<Omit<Contact, 'id'>>): void {
  const db = getDb();
  const fields = Object.keys(patch) as (keyof typeof patch)[];
  if (fields.length === 0) return;
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => patch[f] ?? null);
  db.runSync(`UPDATE contacts SET ${setClauses} WHERE id = ?`, [...values, id]);
}

export function deleteContact(id: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM contacts WHERE id = ?`, [id]);
}
