# Hint iOS beta candidate

Status: **not ready for TestFlight upload**. This work prepares and verifies source; it does not deploy, send invitations, use paid providers, or modify the existing database.

The owner confirmed on 2026-09-09 that the production API, public invitation/download URLs and Apple Team ID are not configured. This Mac currently selects `/Library/Developer/CommandLineTools`; full Xcode and the iPhone Simulator SDK are unavailable. These are release blockers, not passed checks.

The candidate requires **iOS 16.4 or later**. The prior native target of iOS 15 was lower than the existing Tailwind 4 interface's Safari 16.4 requirement. Native deployment targets and the Vite JavaScript/CSS targets now agree with that dependency floor. The minimum supported OS still needs real device evidence. See [Tailwind compatibility](https://tailwindcss.com/docs/compatibility).

## Version and evidence

- Starting source: 1,398 files including the existing uncommitted work; manifest SHA256 `85492bf372c24ac09c188b4ba1b69657ce8bb9b55b097a424ab72eacdf62b78a`.
- Starting manifest: `/tmp/hint-testflight-candidate-20260909-211052/source-manifest.json` (excludes local secrets, dependency caches and build/test outputs).
- RC3 runtime source: 1,356 files, SHA256 `cb5ff5d514bcd31b8b7db88e933511fc46fb95329bc4eac4a18be1d4bbc5b18c`. Public artwork is copied into the isolated candidate; it is not a symlink to an editable asset directory.
- RC3 built web assets: 498 files, manifest SHA256 `1c3e5a3e61553a6eb743d668be658b955ce99c7e70d0eec2c8e144414674f53c`. Runtime and built-asset manifests are in `/tmp/hint-testflight-candidate-20260909-211052/rc3-*-manifest.json`. The workspace-to-candidate comparison matched at freeze and is checked again at handoff.
- RC3 frontend: **414 tests / 49 files passed**, library/frontend/backend typechecks passed, frontend/API production builds passed. API: **47 tests / 8 files passed**, including **17 actual disposable PostgreSQL integration tests**. These are retained results from RC2: all 121 API/library runtime files and eight API test files are byte-identical in RC3; API typecheck and build were also rerun in RC3. The final change is a localized accessibility label on receipt thumbnails, covered in all four non-English browser sharing cases. Release scripts: **6 passed**; native static preflight passed. RC3 production WebKit: **390 passed, 20 intentional scope skips, zero unresolved failed/flaky cases**, accounting for all 410 configured scenario/device pairs against these same assets. RC2 browser results are kept separately and are not added to RC3 totals.
- Main entry JS is **904.51 KB (302.81 KB gzip)**, down from the prior 1,560.607 KB baseline after route splitting. The build still reports a >500 KB chunk warning. Bundle size is not evidence of physical frame pacing.
- Durable final evidence: [RC3 bundle](./testflight-evidence/rc3/README.md). Detailed behavior/reproduction register: [testflight-repairs.md](./testflight-repairs.md). Exact scenario assertions and uncovered variants: [coverage inventory](../../../docs/testflight-coverage.md).

## Final RC3 verification — 2026-09-10

| Evidence partition | Passed | Intentional skips | Unresolved failures |
| --- | ---: | ---: | ---: |
| Main app, excluding the replaced locale-surface partition | 200 | 8 | 0 |
| Final four-language surface audit | 16 | 0 | 0 |
| Tarot room and all nine spreads | 140 | 12 | 0 |
| Sharing and shared touch targets | 26 | 0 | 0 |
| Standalone motion observations | 8 | 0 | 0 |
| **Unique configured total** | **390** | **20** | **0** |

The [final scenario registry](./testflight-evidence/rc3/rc3-final-test-registry.json) checks the entire 410-case inventory for omissions, duplicates and retries. The eight main skips are the Pro Max duplicates of the SE 200% Daily stress cases. Tarot skips nine SE duplicate full-spread journeys, SE frame/soak cases and the Pro Max keyboard-sized-viewport case. Six development-only cases excluded by production configuration are outside this inventory.

The original 224-case main run remains preserved: 215 passed, eight skipped and one WebKit native navigation diagnostic failed the old harness. A plain HTML reproduction generated the same handled-fetch diagnostic without Hint code or a true window error. The corrected test harness classifies only the exact reproduced WebKit diagnostic, during navigation away from matching local read-only fixture routes; actual window errors, unhandled rejections and every other page error still fail. All 16 surface cases were rerun on unchanged assets, with zero true errors and two separately preserved native diagnostics. This is a documented test-only correction, not a rewritten failed report or a product exception filter.

The standalone run used one worker after the other browser jobs stopped. Across **40 measurement windows**, per-window RAF gap p95 ranged **18–29 ms**, the maximum single gap was **68 ms**, and there were **zero ≥100 ms gaps**. Interaction-window p95 was at most 27 ms (Home idle at most 29 ms). These short host WebKit samples use a coarse host regression gate; they do not measure physical touch-to-feedback latency or satisfy native iPhone performance acceptance.

All 1,356 runtime-manifest files matched both the workspace and frozen candidate; all 498 built assets matched, with no extra build files. A separate manifest verifies 96 test/helper/config files match the workspace. The evidence bundle retains these checks, both runtime/build manifests, test-source manifest, individual reports, frame data and 22 selected matching screenshots. It includes temporary-database migration/rollback/restore evidence by reference to the retained API bundle; no existing database was migrated.

## Implemented boundaries

Private server data belongs to the owner of a server-issued device session. A supplied `anonId`, email, profile name, invitation ID or result ID cannot authorize another owner's records. Native credentials use a device-only Keychain entry; the browser beta stores its credential within the selected local profile's namespace. Neither is formal account login or cross-device recovery.

Legacy local records stay available to their local profile. Old remote data is never claimed from an anonymous ID alone. Legacy invitations without provable device ownership are retained in the database and expire; create a new invitation for this beta version. Only the creator and accepting device can fetch completed compatibility results and birth snapshots. Clearing history expires created invitations but preserves profiles, device sessions, settings and daily card locks.

New server credentials must be saved before uploading private content. A storage failure retries the same issued credential; it does not issue another owner. Expired/revoked credentials never silently enroll again. Local-profile switching is an explicit action performed before editing a new person's data and reloads the app after persistence succeeds.

## Coverage matrix

| Area | Regression scope | Evidence status |
| --- | --- | --- |
| Home / Daily | Frozen card identity/reason, real save/retry, notes by date/revision, midnight, statistics, offline sync/conflict, modal focus/scroll | Listed fixture regressions passed in RC3 |
| Tarot | Nine spreads, wash/cut/pick/reveal, detailed reading, follow-up, restore, zoom, private share preview | RC3: 140 passed / 12 intentional device-scope skips; nine full spread journeys and 12 long receipt exports passed |
| Animal / Collection | Enter/reveal/re-enter, save quota/retry, receipt subscription, daily reward reset, matching card ID | Listed fixture regressions passed in RC3 |
| Astrology / Compatibility | Shared validated birth inputs, unavailable states, immutable result, invitation ownership/consent/races/retry/expiry | API isolation tests passed; listed browser fixture regressions passed in RC3 |
| Ask / Journal / Personalities | Draft and transcript persistence, retry, navigation cancellation, history, quiz edit/reload/owner scope, image preview | Listed component and browser fixture regressions passed in RC3 |
| Profile / Onboarding | Different email, explicit local-profile selection, failed writes, correct save status, settings, clear-history scope | Listed component and browser fixture regressions passed in RC3 |
| History / Rooms / Legal | Filters, local partial results, errors, original content, search/empty/preview labels, truthful beta copy | Listed fixture regressions passed in RC3 |
| Motion / Layout | Two phone sizes, bright/dark, four independent reduced-motion combinations, offscreen/background pause, 200% text, hitboxes | Phone layout/focus/hitbox checks and all eight standalone motion cases passed; physical-device performance remains unverified |
| Server / Database | Real session middleware, spoofed IDs, result access, revocation, durable quotas, migration ledger/lock/rollback/checksums, restart | 47 retained tests passed with byte-identical API/library code; isolated API restart preserved 33 invitations / 16 completed results |
| Native | Keychain, Associated Domains, cold/warm links, five-language permission strings, bundled privacy manifest, verified-assets check | Source checks pass; Simulator and device **unverified** |

## Visual-review boundaries and remaining polish

SE 375×667 and Pro Max 440×956 browser frames were exercised. The sharing/touch run passed 26 cases; the main run passed the Daily/History, 200% text and navigation-clearance regressions. Review includes actual top/middle/bottom screenshots and targeted button hit tests, not only horizontal-overflow measurements. The final locale-surface pass covered 304 route visits and produced 912 top/middle/bottom screenshots; 16 cases passed. Standalone motion figures are recorded with the final evidence below.

At 200% web text magnification, narrow navigation and accessory columns may wrap long words inside the word. The Daily note field retains its fixed, internally scrollable input area, so a long multiline placeholder is not all visible at once; the field label and bottom content remain reachable. These are documented limits, not proof that every glyph is visible simultaneously. Browser text magnification is not native Dynamic Type acceptance.

Some existing illustrations contain baked-in English, including “Pen-point” and “Glasses”; these remain minor artwork-localization polish, separate from translated accessible labels and advice. All artwork/font/audio rights still require an owner-supplied licence/attribution record. Generated historical wording and explicitly labelled original-English public reflections remain in their original language. Structural locale checks and targeted semantic review do not certify every sentence as professionally translated.

## Production configuration

Set these values outside source control. `check-mobile-env.mjs` rejects missing values, localhost/IP origins, placeholders, non-HTTPS addresses and mismatched associated domains.

| Setting | Meaning |
| --- | --- |
| `VITE_API_BASE_URL` | Public API hosting base, before `/api` |
| `VITE_HINT_PUBLIC_URL` | Public app hosting base, before `/app`; retains an optional hosting subpath |
| `VITE_HINT_DOWNLOAD_URL` | Public installation / TestFlight download page |
| `HINT_ASSOCIATED_DOMAIN` | Hostname of the public app, without a scheme or path |
| `HINT_APPLE_TEAM_ID` | Apple application identifier prefix, verified against the signed app |
| `HINT_ALLOWED_ORIGINS` | Explicit browser origins allowed by the API; native origins are included by the server |
| `HINT_TRUSTED_PROXIES` | Only the actual reverse proxies whose forwarded IP headers are trusted |

Run `node scripts/prepare-universal-links.mjs` from the frontend package after configuration. Its generated AASA must be served at the **domain root** `/.well-known/apple-app-site-association`, over HTTPS without redirects. Hosting a project under a subpath does not move Apple's association lookup. Browser invitation landing pages show installation instructions and never request birth details or results. The native handler accepts only invitation paths on the configured origin. Complete first use and return to the same invitation.

## Candidate validation and packaging

1. Freeze source and public assets; retain the file manifest and immutable revision. Do not package while edits continue.
2. Use an isolated PostgreSQL instance and fictional fixtures. Run the reviewed incremental migration runner, repeat it and check its ledger. Exercise the migration rollback/concurrency suite and restore a backup into another temporary database. Never run `db:push` on the existing database.
3. Run library/frontend/backend typechecks, all unit/component/API/database tests, both production builds and production Playwright journeys against those exact assets. `e2e/fixtures.ts` prevents unmocked live API requests. No snapshot refresh is an acceptance substitute.
4. Keep the web build that passed. `ios-candidate.yml` downloads that build into the same source revision, runs `cap sync ios`, then `check-native-assets.mjs`; it does not rebuild web assets or upload TestFlight.
5. With full Xcode, run the unsigned Simulator build, inspect the archive's privacy report, then prepare a signed **device** archive using the verified application identifier, associated domain and correct distribution profile. The current CI simulator artifact is not an uploadable TestFlight IPA.
6. Perform the physical-device matrix below and retain videos/traces/screenshots. Prepare beta notes and feedback contact. Only after a separate release decision should an authorized operator upload an internal TestFlight build, validate it internally, and request external beta review.

The Pages workflow is now manual and requires verification before its separately built Pages artifact is tested and published. The iOS workflow contains no publishing step. No workflow was triggered during this task.

## Physical-device acceptance — all currently unverified

- Cold launch, background/foreground, forced termination and five consecutive Tarot journeys.
- Keyboard positioning, Chinese/Japanese/Korean text composition, long inputs and accessibility text sizes.
- App reduced motion, system reduced motion, both, neither; 60 Hz interaction feedback p95 ≤100 ms, frame gap p95 ≤33 ms, no repeated ≥100 ms drag stalls.
- Keychain persistence/locked-device access/revocation, distinct local profiles and offline reconnect.
- Microphone/speech permission denial, cancellation, interruptions, haptics, native share cancellation and temporary-file cleanup.
- Installed/uninstalled universal links, actual hosted AASA and first-use return routing.
- Signed archive identity, distribution signing, actual embedded web asset hashes and release privacy report.

Browser RAF measurements are host observations. They do not prove iPhone frame pacing or native readiness.

## Data use and release materials

The app privacy manifest currently declares names, installation/profile identifiers and other user content for app functionality, with no tracking. User content includes birth details, questions, selected cards, interpretations and journal text submitted to the API. Text-to-speech sends text for synthesis; native speech recognition uses Apple's permission-controlled service. Raw microphone audio is not sent by the Hint speech-synthesis endpoint. Review the actual signed app's aggregated privacy report and vendor retention settings before completing App Store Connect disclosures.

The file timestamp reason covers app-owned receipt cache files; UserDefaults reason covers app/SDK-local settings. Confirm all linked SDK manifests in the final archive. Source-level plist validation does not replace Xcode's privacy report.

No asset-specific rights/attribution register was found under `public` in this pass. Ownership/licences for tarot art, animal art, personality art, fonts, ambient imagery and sound must be documented before external distribution. Do not assume the repository's software licence grants artwork rights.

Beta notes should explicitly state: local beta profiles; device-bound server access; no cross-device account recovery; Dream and deep astrology reports remain previews; generated content is for reflection; how to report a problem with a request ID while omitting private questions and birth details.

## Release / rollback procedure

See `artifacts/api-server/docs/testflight-access.md` and `lib/db/migrations/README.md` for server controls and migration details. Take a database backup, rehearse restore in a separate database, run reviewed migrations before switching the server, and require readiness before admitting traffic. Retain the previous signed binary and compatible server build. For incidents, stop new enrollment/provider admission and revoke compromised sessions as needed. Roll back compatible application code; never delete migrated columns or restore production data blindly. A schema/data rollback requires a reviewed recovery procedure and its own explicit authorization.

Official references: [Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains), [Privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [TestFlight](https://developer.apple.com/testflight/).
