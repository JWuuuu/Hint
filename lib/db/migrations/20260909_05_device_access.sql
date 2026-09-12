-- Deliberately no backfill from legacy anon_id: possession of that id is not proof of ownership.
CREATE TABLE IF NOT EXISTS device_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL UNIQUE,
 token_hash text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 CHECK (length(token_hash)=64)
);
ALTER TABLE compatibility_invites ADD COLUMN IF NOT EXISTS accepter_owner_id uuid;
-- Retain old snapshots for an explicit, reviewed migration; old links cannot enroll a new owner.
UPDATE compatibility_invites SET expires_at = LEAST(expires_at, now())
WHERE NOT EXISTS (SELECT 1 FROM device_sessions WHERE device_sessions.owner_id::text = compatibility_invites.owner_id);
CREATE INDEX IF NOT EXISTS compatibility_invites_accepter_idx ON compatibility_invites(accepter_owner_id);
CREATE TABLE IF NOT EXISTS request_budgets (
 bucket_key text NOT NULL, period_start timestamptz NOT NULL,
 used integer NOT NULL CHECK (used >= 0), expires_at timestamptz NOT NULL,
 PRIMARY KEY (bucket_key,period_start)
);
CREATE INDEX IF NOT EXISTS request_budgets_expiry_idx ON request_budgets(expires_at);
CREATE TABLE IF NOT EXISTS provider_leases (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS provider_leases_expiry_idx ON provider_leases(expires_at);
