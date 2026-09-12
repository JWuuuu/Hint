BEGIN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone_offset double precision;
COMMIT;
