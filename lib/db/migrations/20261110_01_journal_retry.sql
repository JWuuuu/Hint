-- Legacy entries keep a NULL key. New clients retain one key and editedAt for
-- each deliberate save across retries, including a lost successful response.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS client_request_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_owner_request_unique
  ON journal_entries(anon_id, client_request_id);
