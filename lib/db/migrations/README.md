# Additive quality migrations

Run `pnpm --filter @workspace/db migrate` before the updated server. The runner
applies numbered `20260909_00` through `20260909_05` files under one session-level
advisory lock, with a transaction and SHA-256 ledger for each file. Changed applied
files fail closed. `migrate:check` checks for pending/changed files without changing
the ledger. Never use schema push against an existing database.

1. Preserve reveal locks while excluding cleared history.
2. Add optional profile coordinates and time zones; existing values remain unknown.
3. Persist compatibility invitations, consent, job leases and immutable results.
4. Persist deletion watermarks, including offline receipts first uploaded later.
5. Add installation credentials, authenticated invitation participants and durable
   request budgets/leases. Only token hashes are retained. Old identity strings are
   never ownership proof; old rows remain quarantined and old invites expire.

Migration 00 bootstraps the previous core schema on a fresh database and preserves
existing tables. Keep previously reviewed numbered SQL immutable. New changes use
the next additive migration. Set `DATABASE_URL` explicitly in the deployment secret
store; the runner does not load local environment files.

Rehearsed against an isolated PostgreSQL 18 database created from the repository's
previous schema. Each migration was applied twice to check repeatability. The
fixture's original profile fields remained intact. No existing application database
was migrated. Application rollback can leave these additive columns/tables in place;
do not drop persisted invitation results or deletion watermarks during rollback.
Once real beta credentials/data are in use, rollback only to a credential-enforcing
server. Rolling back to the legacy unauthenticated API would expose private data.

The local beta has no automatic claim/import of legacy remote rows. A future import
requires separately verified ownership and reviewed tooling, never an `anonId`
submitted by the client. Current local copies remain on the device. Migration 05
preserves the legacy server snapshots while expiring their invitation links.

`artifacts/api-server/src/quality/persistence.integration.test.ts` requires the
explicit isolated database flag and rejects any other database URL.

The final device-access candidate was rehearsed on 2026-09-09 in a separately
created/dropped temporary PostgreSQL 18 database. The two regression cases in
`artifacts/api-server/src/quality/migrations.integration.test.ts` passed as part
of the final frozen-copy API suite (47 tests across eight files):

| Rehearsal | Verified outcome |
| --- | --- |
| Reject ledger insert for migration 01 | Both its DDL and ledger entry rolled back. |
| Retry with two concurrent runners | Both completed with exactly one ledger row per file, six rows total. |
| Repeat/check already applied files | Existing entries were reused and the read-only ledger check reported current. |
| Migrate a legacy profile and invitation | Profile values and invitation input snapshot remained intact; the legacy invite expired. |
| Tamper with the stored applied digest | Validation failed closed; the preserved profile remained unchanged. |

The suite requires `HINT_ISOLATED_DB=1` and exactly
`postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality`; it refuses
other URLs. The isolated role needs `CREATEDB` to create the random rehearsal
database, which is dropped after the cases. Production runtime permissions should
not copy that test-only privilege.

Separately, an API/PostgreSQL restart rehearsal retained 33 fictional invitations
(16 completed) with an identical ordered snapshot digest. See
`artifacts/api-server/docs/testflight-access.md` for the recorded digest and final
verification logs. Restart persistence does not substitute for a backup/restore
rehearsal in the intended hosting environment. No real database was migrated.
