-- Private beta access: when invites are required, a new device session needs a
-- tester invitation. Only SHA-256 hashes of invitation codes are stored.
-- Revoking an invitation also ends the device sessions it enrolled.
CREATE TABLE IF NOT EXISTS tester_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE CHECK (length(code_hash)=64),
  label text NOT NULL UNIQUE CHECK (length(label) BETWEEN 1 AND 80),
  max_devices integer NOT NULL DEFAULT 3 CHECK (max_devices BETWEEN 1 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
ALTER TABLE device_sessions ADD COLUMN IF NOT EXISTS invite_id uuid REFERENCES tester_invites(id);
CREATE INDEX IF NOT EXISTS device_sessions_invite_idx ON device_sessions(invite_id);
