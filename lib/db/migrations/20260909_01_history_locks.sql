BEGIN;
ALTER TABLE daily_receipts ADD COLUMN IF NOT EXISTS history_excluded boolean NOT NULL DEFAULT false;
COMMIT;
