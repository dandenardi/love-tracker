-- spec 006: pseudonymous per-contact token, solo-domain events only.
-- One-way hash of the mobile-local contact_id, never resolvable server-side.
ALTER TABLE events ADD COLUMN contact_token TEXT;
