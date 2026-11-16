-- Support the existing owner-filtered, timestamp-descending bounded lists.
-- Keep journal retry uniqueness and all deletion/reveal data unchanged.
-- The runner owns the transaction: do not use CREATE INDEX CONCURRENTLY here.
-- On a populated host, separately approve lock/timeout and execution planning
-- before running this migration. See history-owner-indexes.md.
CREATE INDEX readings_owner_created_at_idx ON readings (anon_id, created_at DESC);
CREATE INDEX journal_entries_owner_created_at_idx ON journal_entries (anon_id, created_at DESC);
