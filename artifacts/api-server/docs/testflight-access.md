# TestFlight beta server boundary

The API uses a per-installation credential, not a formal account or cross-device
login. `POST /api/device-sessions` creates an independent owner UUID and returns a
256-bit opaque Bearer token once, expiring after one year. The database retains only
its SHA-256 hash. `GET /api/device-session` verifies access; `DELETE` revokes it.
The native client stores the token in Keychain. Revoked/expired credentials return
401; clients must preserve local data and never silently create another owner.

Every private route uses the verified server owner. Legacy `anonId`, `userId`,
`anonymousDeviceId` and `createdByUserId` fields cannot claim someone else's data.
Old remote data is retained without an automatic ownership migration. Old invites
expire. A future migration requires independently verified ownership.

Invite metadata is public by its random token. It includes creator display name,
relationship type, status and expiry, but no birth input. Result IDs are returned
only to the creator or bound accepter. Results require one of those installations;
unrelated callers receive 404. First consent binds the accepter atomically and
cannot be replaced by another installation. Calculation retries preserve that
participant binding. Owner history deletion invalidates owned invitations/results.

## Deployment configuration

- `HINT_ALLOWED_ORIGINS`: comma-separated exact web origins. Native origins
  `capacitor://localhost` and `https://localhost` are allowed. Development alone
  permits HTTP(S) loopback origins. Never use `*` for production web access.
- `HINT_TRUSTED_PROXIES`: explicit trusted proxy IPs/CIDRs understood by Express.
  Leave unset without a proxy. Raw client `X-Forwarded-For` is not authoritative.
- `HINT_DEVICE_ENROLLMENT_CLOSED=1`: closes new connections without revoking current
  installations. No shared enrollment secret is embedded in the app.
- Enrollment defaults: 10 connections per trusted IP/hour and 200 globally/day.
  Set `HINT_ENROLLMENT_PER_IP_HOUR` / `HINT_ENROLLMENT_GLOBAL_DAY` to adjust.
- Paid admission defaults: 500 request units globally/day, 30 per trusted IP/minute
  and 8 concurrent jobs. `HINT_PROVIDER_GLOBAL_DAY`, `HINT_PROVIDER_PER_IP_MINUTE`,
  `HINT_PROVIDER_MAX_CONCURRENT` adjust them. Existing per-feature
  `AI_LIMIT_<FEATURE>_PER_MINUTE` / `_PER_DAY` settings remain supported.

These are request ceilings, not a monetary meter. A compatibility request can use
multiple provider calls. Provider-dashboard spending caps remain a release gate.
Counters and global admission leases live in PostgreSQL and survive restarts.
Finished responses release leases; interrupted jobs retain a conservative ten-minute
lease, after which another job can proceed. No provider call is made by health checks.

Run reviewed migrations before starting the candidate. `/api/healthz` is liveness;
`/api/readyz` checks the database and migration ledger and fails during shutdown.
SIGTERM/SIGINT drain accepted HTTP requests, then close the database pool. Server
errors expose a stable message and correlation ID, never raw provider/SQL details.
All manual JSON errors also carry a stable `code` and the same `requestId` as
`X-Request-Id` and server logs. Invite tokens are masked in logged paths, including
case variants and URL-encoded paths. Readiness compares migration SHA-256 digests
against the exact manifest embedded in the API build.

## Data inventory and deletion boundaries

| Data | Storage and access | Lifetime and deletion |
| --- | --- | --- |
| Installation secret | Plaintext exists only in the creating client; server stores hash, owner UUID, creation/expiry/revocation times in `device_sessions`. | One-year access expiry; explicit revocation stops access. Expiry/revocation does not delete history or silently create another owner. |
| Profile | `profiles`: display name, birth date, optional time/place/coordinates/timezone. Only authenticated owning installation can read/write it. | Preserved by Clear History. No automatic profile purge or cross-device recovery is implemented. |
| Reading and journal history | `readings`, `daily_pulls`, `journal_entries`: card identity, reading date, optional question/note/journal text and mood. Owner-scoped APIs; some Tarot/chat content stays in client storage rather than these tables. | Clear History transaction deletes the owning installation's server history. Failed deletion retains it. |
| Reveal locks and deletion markers | `daily_receipts`, `history_clears`: owner, feature/day/card/orientation, reveal timestamps, history exclusion and deletion boundary. | Kept when history is cleared so the card cannot change or recreate deleted history. They are not returned as restored reading history. |
| Invitations and results | `compatibility_invites`: random link token, owner/accepter UUIDs, immutable birth input snapshots/results, consent time, expiry, job lease. | Invite lasts seven days. Result access requires creator/accepter credential. Creator Clear History deletes the invite/result and invalidates the link. Link expiry alone does not erase a saved result. |
| Quotas and work leases | `request_budgets`, `provider_leases`: hashed trusted-IP keys, owner IDs, counters and deadlines. No question or birth input. | Expired quota/lease rows are removed during subsequent budget operations. Limits survive process/database restarts. |
| Legacy remote rows | Previous anonymous-owner records remain stored but cannot be claimed by submitting an old ID. Legacy invites expire and are rejected by runtime ownership checks. | Retained for separately reviewed, independently verified migration or deletion. No automatic import/claim is exposed. |
| Operational logs | Request UUID, sanitized route, method, status and safe error classification. Body, query values, Bearer tokens and raw provider/database errors are omitted. | Host log retention is an operator setting and must be reviewed before TestFlight deployment. |

Provider calls can transmit user-entered Tarot/Ask questions and conversation
context to the configured AI provider; chart calls transmit birth date/time and
location coordinates/timezone to the configured astrology provider. NASA requests
use date and server API configuration. Provider retention is not controlled by
Clear History and is not claimed to match local deletion. Review provider settings,
spending limits and disclosure text against the actual deployment configuration.
No paid provider call was made during this implementation's automated checks.

Per-installation access protects records from other beta installations; it does
not establish a person's identity, provide account recovery, or authorize sharing
a secret between devices. A copied/lost credential is a separate security event.

## Required release evidence

Run the guarded `quality/*.integration.test.ts` suites only against the explicit
temporary PostgreSQL fixture URL. They check ownership spoofing, legacy isolation,
invitation participants, revoked/expired sessions, quotas, lease recovery, migration
rollback/concurrency/digests and persistence. Production deployment still requires
reviewed trusted-proxy/origin settings, provider spending caps, backup/restore,
monitoring, and current native Keychain/build/device evidence. This work performs
no real deployment, real database migration or paid provider test.

### Recorded candidate evidence — 2026-09-09

The final API checks ran from the frozen copy
`/tmp/hint-testflight-candidate-20260909-211052/work-final`, using only PostgreSQL
at `127.0.0.1:55439/hint_quality` and fictional records. Evidence logs are under
`/tmp/hint-testflight-candidate-20260909-211052/`; retain these with the candidate
manifest when moving the release evidence out of temporary storage.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Final backend suite | 47 tests passed across eight files, including all 17 guarded integration tests. Default file parallelism passed. | `final-backend-tests.log` |
| Final backend TypeScript check | Passed with no diagnostics. | `final-backend-typecheck.log` |
| Final production API build | Passed; embeds the expected migration names and SHA-256 digests. | `final-backend-build.log` |
| Migration failure, retry and concurrency | Failed ledger insertion rolled back that migration's DDL. Two subsequent concurrent runners produced exactly six ledger entries; the ledger check passed. | `src/quality/migrations.integration.test.ts`, included in the final suite |
| Legacy migration safety | Original profile values and invitation input snapshot remained intact; the legacy link expired. Altered applied digest was rejected without changing the profile. | `src/quality/migrations.integration.test.ts`, included in the final suite |
| Process and database restart | The compiled API and isolated PostgreSQL were stopped and restarted. The same credential then read its session, profile and invitation successfully; readiness returned 200. | Separate local restart rehearsal; fixture secret removed after the check |
| Persisted invitation contents | All 33 invitation fixtures, including 16 completed results, retained the same ordered-record SHA-256 digest before and after the restart. | `/tmp/hint-quality-postgres/before-restart.json` and `/tmp/hint-quality-postgres/restart-proof.mjs` |

The restart digest was
`f6a3f9058c1477e558e77104bde615bc06e3fa4b7058b2f6bbea9a78bc526cac`.
It covers token, status, result ID/result, creator/friend inputs, consent and expiry
in token order. Later fixture tests can change these rows; this records the
completed restart experiment, not a permanent checksum of the test database.

To repeat the final backend suite after dependencies and migrations are available,
run from `artifacts/api-server` with the exact isolated fixture credentials:

```sh
HINT_ISOLATED_DB=1 \
DATABASE_URL=postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality \
LOG_LEVEL=silent node node_modules/vitest/vitest.mjs run src
```

The suite rejects a different database URL. Its migration rehearsal creates and
drops a separate random temporary database, so the isolated fixture role needs
`CREATEDB`; that test requirement does not justify granting it to the production
runtime role. These fixture results do not establish native packaging, deployed
network behavior, provider accuracy or backup recovery.

### Open operational gates for the first TestFlight beta

- Supply the actual HTTPS API/public hosts, exact web CORS origins and verified
  trusted proxy IPs/CIDRs. `render.yaml` does not invent these values. Confirm
  accepted/rejected origins and the resulting client IP from the real ingress;
  leaving proxy trust unset behind a proxy aggregates IP quotas, while trusting
  unverified forwarding headers lets a caller evade them.
- Set pilot enrollment/provider limits and provider-dashboard spending caps, with
  alerts and a named operator able to close enrollment or revoke a credential.
  New installation enrollment is public by design; TestFlight distribution does
  not authenticate API enrollment. Per-installation caps are not person-level
  account security, and the global ceiling is admission units rather than dollars.
- Verify edge abuse controls and availability monitoring. Invalid credentials
  are rejected before the private owner budget; the app does not implement a
  separate pre-authentication invalid-token attempt budget. Public health routes
  are also outside the private budget. Request caps do not establish resistance
  to every traffic-based denial of service.
- Rehearse backup restoration in the intended hosting environment, review
  database transport/network permissions and separate migration DDL permissions
  from runtime access where supported. The local restart proof is not a backup
  restoration test. Review migration results before allowing candidate traffic.
- Configure secrets outside the build artifact, exclude local `.env` files from
  deployment, and review access and retention for host logs and provider data.
  Verify the host's termination grace period against the API's maximum
  150-second drain; test readiness removal and interrupted-work recovery there.
- Publish the actual beta data/retention support process. Credential expiry or
  revocation does not erase stored data. Only the creator can remove a shared
  invitation/result through Clear History; an accepter's history deletion does
  not remove the creator-owned snapshot. Profile and legacy data have no automatic
  purge or verified recovery workflow. Any support-assisted action needs its own
  ownership review.
- Complete signing, native Keychain, lifecycle and physical-device evidence for
  the actual iOS candidate. Backend/browser checks do not mark these gates passed.

None of these real deployment/provider/device checks was performed as part of
this isolated verification, and no deployment or real database mutation occurred.
