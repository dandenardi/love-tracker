-- Migration to support multiple partnerships and unpairing

-- 1. Create partnerships table
CREATE TABLE IF NOT EXISTS partnerships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_2       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active', -- 'active' or 'unpaired'
  created_at      BIGINT NOT NULL,
  unpaired_at     BIGINT,
  CONSTRAINT unique_partnership UNIQUE (user_id_1, user_id_2)
);

-- 2. Add partnership_id to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL;

-- 3. Migration logic for existing monogamic data
-- Move partner_id from users to partnerships
INSERT INTO partnerships (user_id_1, user_id_2, status, created_at)
SELECT 
  CASE WHEN id < partner_id THEN id ELSE partner_id END as u1,
  CASE WHEN id < partner_id THEN partner_id ELSE id END as u2,
  'active', 
  created_at
FROM users 
WHERE partner_id IS NOT NULL
ON CONFLICT (user_id_1, user_id_2) DO NOTHING;

-- Map existing events to the correct partnership
UPDATE events e
SET partnership_id = p.id
FROM partnerships p
WHERE (e.user_id = p.user_id_1 OR e.user_id = p.user_id_2)
AND e.partnership_id IS NULL;
