# Owner history indexes

`20261111_01_history_owner_order.sql` adds one nonunique B-tree index to each of
`readings` and `journal_entries`, on `(anon_id, created_at DESC)`. It supports the
existing newest-100 readings and newest-200 journal queries. The journal retry
index `(anon_id, client_request_id)` remains necessary for uniqueness; it cannot
provide timestamp ordering. There is no extra owner-only or ID-suffix index.

No routes, response shapes, limits, retention rules, uniqueness, owner predicates,
deletion watermarks, or advisory locks change. Timestamp ties remain unspecified;
a changed physical access path can select different tied rows at the LIMIT
boundary. These lists are not fully paginated histories.

## Execution gate

This is an additive proposal rehearsed only with synthetic local PostgreSQL data.
It is compatible with the existing runner, which serializes runners and wraps
each migration and ledger insert in one transaction. Historical SQL stays
immutable. There is deliberately no `IF NOT EXISTS`: an unexpected same-name
index must stop execution for inspection instead of accepting an unknown shape.

Ordinary index creation blocks writes while it builds. Before a populated host
runs this migration, an operator must inspect the actual schema/index catalog,
table sizes, free storage, long transactions and workload; agree on lock and
statement timeouts, a maintenance window and recovery ownership; and verify the
hosted backup/restore policy. Local timings do not establish an acceptable hosted
lock window. No production execution is approved by this proposal.

If online creation is required, design and separately approve a concurrent-index
and migration-ledger strategy first. `CREATE INDEX CONCURRENTLY` cannot be placed
in this transaction runner. Do not pre-create these names and fake ledger entries
or alter a previously applied migration digest. Failed concurrent creation may
leave an invalid index and needs its own reviewed cleanup/retry plan.

## Recovery conditions

Before commit, a DDL, lock-timeout or ledger failure rolls back the entire new
migration. Verify that both new indexes and its ledger row are absent; diagnose
the failure before rerunning the unchanged file. Existing rows and older ledger
entries must remain intact. An unexpected pre-existing index requires catalog
review, not an automatic drop.

After commit, application rollback should leave both additive indexes in place;
old code remains compatible. If measured operational regression justifies index
removal, use a separately approved new forward migration/execution plan, after
checking dependencies and locks. Remove only these two nonunique indexes if
approved. Never remove the journal uniqueness index, deletion watermarks or
receipt locks, and never edit/delete historical ledger rows. No rollback or
production cleanup is executed by this proposal.

The new migration must flow into the build's migration-derived schema digest.
There is no hardcoded provenance edit. H5 owns final assembly and validation.

PostgreSQL references: [multicolumn indexes](https://www.postgresql.org/docs/18/indexes-multicolumn.html),
[index creation and concurrent-build restrictions](https://www.postgresql.org/docs/18/sql-createindex.html).
