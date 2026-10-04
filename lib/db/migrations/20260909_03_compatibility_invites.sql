BEGIN;
CREATE TABLE IF NOT EXISTS compatibility_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  owner_id text NOT NULL,
  relationship_type text NOT NULL DEFAULT 'unclear',
  creator_input jsonb NOT NULL,
  friend_input jsonb,
  consent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  job_id uuid,
  lease_until timestamptz,
  result_id uuid UNIQUE,
  result jsonb,
  CHECK (status <> 'completed' OR (result_id IS NOT NULL AND result IS NOT NULL AND consent_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS compatibility_invites_owner_idx ON compatibility_invites(owner_id);
COMMIT;
