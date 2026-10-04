CREATE TABLE IF NOT EXISTS history_clears (
  owner_id text PRIMARY KEY,
  cleared_at timestamptz NOT NULL,
  through_day text NOT NULL CHECK (through_day ~ '^\d{4}-\d{2}-\d{2}$')
);
