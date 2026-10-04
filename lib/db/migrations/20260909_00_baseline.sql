-- Bootstrap a fresh database; existing beta rows and tables are preserved.
CREATE TABLE IF NOT EXISTS profiles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL UNIQUE,
 name text NOT NULL, birth_date text NOT NULL, birth_time text, birth_place text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS daily_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text, anonymous_device_id text NOT NULL,
 daily_key text NOT NULL, feature_type text NOT NULL, assigned_card_id text, orientation text,
 assigned_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 opened_at timestamptz, last_seen_at timestamptz,
 CONSTRAINT daily_receipts_device_day_feature_unique UNIQUE (anonymous_device_id,daily_key,feature_type)
);
CREATE TABLE IF NOT EXISTS daily_pulls (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL, pull_date text NOT NULL,
 card_id text NOT NULL, card_name text NOT NULL, whisper text NOT NULL,
 is_flipped boolean NOT NULL DEFAULT false, note text, created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT daily_pulls_anon_date_unique UNIQUE (anon_id,pull_date)
);
CREATE TABLE IF NOT EXISTS journal_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL, title text,
 body text NOT NULL, mood text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS readings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), anon_id text NOT NULL, card_name text NOT NULL,
 whisper text NOT NULL, spread_type text NOT NULL, question text, territory text,
 created_at timestamptz NOT NULL DEFAULT now()
);
