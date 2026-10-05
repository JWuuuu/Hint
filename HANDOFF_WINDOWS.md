# Hint Windows handoff — three-way merge, 2026-09-30

Continue the merged application, rather than importing either ZIP over it.

**Goal paused at the owner's request; confirmed on 2026-09-30.** Wait for an explicit request to resume. The acceptance scope expanded on 2026-09-29: the owner requires actual iPhone acceptance and a prepared TestFlight candidate, without uploading. Browser acceptance is only the first layer. Continue `artifacts/hint/docs/ios-acceptance-2026-09-29/README.md`; Simulator, physical-device evidence and a signed candidate are required before the goal can be complete. The merge evidence below is historical evidence for its exact revision, not an iPhone release approval.

**Named checkpoint:** `checkpoint-2026-09-30-merged-app`. Read [the checkpoint record](artifacts/hint/docs/checkpoints/2026-09-30-merged-app.md) for exact source/build fingerprints, preview state and outstanding work. This checkpoint adds documentation only; the application implementation remains `3280bcf`.

**Subsequent owner-requested Home/Daily correction:** [ZIP fidelity review](artifacts/hint/docs/home-daily-ui-2026-09-30/README.md), implementation `69d32dc`. It restores the ZIP's date-first Daily and Home composition, keeps sharing compact, and fixes the Home offline status entering the iPhone island area. Tarot is unchanged. This narrow task does not resume the paused Goal; use the latest integration branch rather than the older named checkpoint for these corrections.

- Repository: https://github.com/JWuuuu/Hint.git
- Integration branch: `merge-home-daily-receipt`
- Current implementation checkpoint: **`69d32dccfc4e9cb6acb1b05313ca17a6dae4ac80`**. Its following documentation commit records this focused correction; use the latest integration-branch tip.
- Historical merge implementation: `2f6c1962aa0cee608ec536daa835148fc3a7d98a`; expanded iPhone acceptance is still incomplete.
- Original handoff remains untouched: `windows-handoff-2026-09-12` at `b9594adf2f4d3114cf8bc33d6cd319d123477a13`.
- `main` is not the working baseline; do not replace this branch with it. The `old-hint` remote has a disabled push URL.

## What is combined

| Contributor | Retained work |
|---|---|
| Your functional version | All nine Tarot spreads, lighter clockwise Wash, three-pile Cut, **2.8-second two-packet Shuffle**, Pick/Reveal/Reading, follow-ups, history, identity and data safeguards; complete Pearl Moonlight Astrology charts and in-app reports |
| Xiaoyu / 小宇 | Home typography/spacing, daily card composition, score presentation, room tiles, Daily date strip and score columns, bottom navigation appearance |
| Tiantian / 甜甜 | Printer machine and paper artwork, feed/print animation; now an actual sharing dialog for Home, Daily and current/archived Tarot readings |

Share opens over the existing reading and restores focus when closed. It takes an immutable snapshot; opening, replaying and exporting never redraw a card. Private questions and personal interpretations are excluded by default on every opening, chat is always excluded, and optional private text requires explicit consent. A completed print is distinct from a prepared PNG. Oversized private text offers an explicit public-card fallback; it is not silently cut. Missing production URLs omit the QR/link.

Historical Daily cards use saved IDs; an unopened assignment cannot become a historical reading. Missing historical scores/lucky details are omitted. Notes, offline daily-card identity, collection, history deletion and retries retain the functional baseline.

New CSS is scoped. Tarot deck order, physics, state machine, reading persistence, identity and clear-history core files are byte-identical to the original handoff. There are no API/schema/migration changes in this merge.

## Current continuation point

**Owner asked to save progress on 2026-09-29: Windows is not ready yet. Do not start another extended Mac run.** System power logs show a 442-second Thermal Emergency Sleep matching a 440.8-second Playwright screenshot stall. No power or thermal protection was overridden. Read `artifacts/hint/docs/ios-acceptance-2026-09-29/mac-interruption.json`.

Read the acceptance README first. The receipt PNG encoder now runs in a cancellable worker; ten browser samples have no >=100ms gap and eight before/after exports have identical decoded pixels. Home/Daily night-theme inheritance, complete detailed card copy, and enlarged score reflow are repaired. At `e23754b`, the 160-case merge matrix, 703 frontend tests, 66 API/database tests and four actual browser→API→temporary-DB journeys passed, along with frontend/API types and builds.

Runtime `3280bcf` added a confirmed dark Ask-label ink repair, with an explicit before-fail/after-pass regression. The subsequent `69d32dc` Home/Daily correction passed 19 targeted unit/component cases, 34 targeted browser cases, frontend types and the production build on the same source. The new built web fingerprint is **`2230afa92a8c2e4fbabac13f91d20e3828a912d9da63b389fde3bd5b9f89c118`**. Mac's isolated preview is `http://127.0.0.1:5255/app?hintPreview=frame`, serving `/tmp/hint-home-daily-zip-ui-final-20260930`; older previews do not include this correction. Temporary builds/logs are not transferred by Git; durable registries and selected screenshots are in the focused ZIP fidelity review folder.

Nine protected functional-core files remain unchanged. Three stale SE pick references were individually reviewed and the six normal comparisons passed; old/actual/diff images and geometry evidence are retained. The interrupted 922-case whole-app run recorded 110 passes, eight skips, one timeout correlated with the thermal sleep, one interrupted case and 802 not run. The affected Astrology case passed three isolated rechecks. This is not a complete run. Expanded SE nine-spread testing is enabled, but its full journeys were not reached in that interrupted run.

Next, when Windows is ready: install dependencies; verify the phone frame; run the complete current functional suite and standalone performance sequentially; review every failure/skip. Re-run full units, API/temporary-DB and types/builds at that final source. Do not omit the earlier run's passed cases using `qa-resume`: the implementation and test assertions changed, so its fingerprint no longer qualifies. Mac Simulator/device checks remain separate.

Native source membership passes, but mobile release build fails because `VITE_API_BASE_URL` is unset. Only Command Line Tools are selected, `simctl` is unavailable, and no USB iPhone is currently visible. Production HTTPS URLs, Apple Team/signing, Simulator, physical-device acceptance and an archive are outstanding. Do not substitute a localhost URL or count the browser matrix as native acceptance.

## Historical merge evidence (before the expanded goal)

Read `artifacts/hint/docs/merge-2026-09-28/README.md`, then `validation.json`, `performance.json`, `protected-core.json`, `runtime-manifest.json` and the phone screenshots. These supersede the incomplete 2026-09-12 acceptance status; the old Astrology documentation is retained for architectural context.

The runtime source/asset manifest SHA-256 is `c9a736697b7cc2c5dfa480d3bfcd4a78d9e1e40ab32fbe0a4b9502a6ce42c6ac` (928 files, excluding tests/docs/build output).

That historical merge run passed 695 frontend unit/component tests and 66 API/disposable-database tests; types and frontend/API builds passed. The 612 functional browser cases recorded 586 passes, 23 planned skips, and the three pre-existing SE golden failures described below. Sequential performance passed 5/5 baseline cases and 9/9 merged cases, including five Tarot rituals (16.2–16.5 seconds each, no progressive slowdown). These historical results are not the expanded goal's completion gate.

The old merged common-flow frame-gap p95 values were 22–28ms. Receipt preparation also had an isolated 183ms frame gap; the newer acceptance report locates and repairs that bottleneck. To resume after an interruption, inspect the exact live process, source/assets and durable progress log before scheduling another run. Mac uses one worker, with builds, functional tests and performance separate.

Historical distinction: three SE pick-screen goldens predated the original functional checkpoint. The separately built original and merged actual pixels matched exactly (`legacy-golden-comparison.json`). Their later individual review is documented in the current acceptance report; retain both sets of evidence.

Mac browser evidence does not establish physical-iPhone or Windows results. Native sharing, keyboard/IME, haptics, voice, lifecycle, signing, production HTTPS URLs and Apple Team ID remain release gates. No deployment, TestFlight upload, paid provider calls or real account/database changes were made.

## Windows checkout and tools

Use a short path and a fresh dependency installation. Do not copy Mac node_modules or browser binaries.

```powershell
git clone -c core.autocrlf=false --branch merge-home-daily-receipt https://github.com/JWuuuu/Hint.git C:\dev\Hint-App
Set-Location C:\dev\Hint-App
git status --short
git log -3 --oneline
node --version
npm.cmd install --global pnpm@11.5.0
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @workspace/hint exec playwright install webkit chromium
pnpm.cmd run typecheck
pnpm.cmd --filter @workspace/hint exec vitest run --maxWorkers=2
pnpm.cmd run build:api
```

The clone keeps LF line endings for the recorded source hashes using a repository-local setting. Use Node 24.x (`.node-version`) and pnpm 11.5.0 (`package.json`). `.cmd` avoids PowerShell launcher-policy problems without changing execution policy. Restart the development app if its PATH has not picked up newly installed tools.

## Isolated app preview

```powershell
$env:HINT_TAROT_E2E = '1'
$env:API_PROXY_TARGET = 'http://127.0.0.1:1'
$env:HINT_E2E_BASE_URL = 'http://127.0.0.1:5254'
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP 'hint-merge-windows'
$env:HINT_QA_BUILD_DIR = Join-Path (Get-Location) 'artifacts\hint\dist\public'
pnpm.cmd run build:web
pnpm.cmd --filter @workspace/hint exec vite preview --host 127.0.0.1 --port 5254 --strictPort
```

Leave that terminal running. Open `http://127.0.0.1:5254/app?hintPreview=frame`; select SE 375×667 or Pro Max 440×956. `/app/tarot?hintPreview=frame` and `/app/astrology?hintPreview=frame` open those rooms directly. This preview deliberately has no live API. Automated fixtures exercise real UI with fictional cards/readings/charts and block unmocked API requests.

From another terminal, set the same `HINT_E2E_BASE_URL` and a new `HINT_HANDOFF_OUTPUT`, then run:

```powershell
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP ('hint-full-functional-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$specs = Get-ChildItem 'artifacts/hint/e2e/*.spec.ts' |
  Where-Object { $_.Name -notin @('motion-performance.spec.ts','receipt-performance.spec.ts') } |
  ForEach-Object { "e2e/$($_.Name)" }
pnpm.cmd --filter @workspace/hint exec playwright test @specs --config playwright.handoff.config.ts --workers=1 --max-failures=5 --grep-invert 'native packaging|sustained animation stalls|five consecutive rituals|host frame samples|host RAF sample|printer frame sample|web frame regression'
```

Run performance separately after functional tests, with no other heavy browser tests:

```powershell
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP 'hint-merge-windows-performance'
pnpm.cmd --filter @workspace/hint exec playwright test e2e/motion-performance.spec.ts e2e/room-entrances.spec.ts e2e/tarot-room.spec.ts e2e/merge-receipt.spec.ts e2e/astrology-quality.spec.ts --config playwright.handoff.config.ts --workers=1 --project iphone-17-pro-max --grep 'web frame regression|host RAF sample|sustained animation stalls|five consecutive rituals|printer frame sample|host frame samples'
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP ('hint-receipt-profile-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
pnpm.cmd --filter @workspace/hint exec playwright test e2e/receipt-performance.spec.ts --config playwright.handoff.config.ts --workers=1 --project iphone-17-pro-max
```

The native watcher test is excluded because it writes temporary native packaging files. Font rasterization and browser performance differ on Windows; inspect geometry and content before treating pixel differences as app defects. Do not update snapshots just to make failures disappear.

For API/DB tests, create a **disposable PostgreSQL 18 database**. Set its `DATABASE_URL` and `HINT_ISOLATED_DB=1`, clear paid-provider keys, then run `pnpm.cmd --filter @workspace/db run migrate`, `migrate:check`, and `pnpm.cmd --filter @workspace/api-server exec vitest run --maxWorkers=1`. Do not use `db:push` or a real database. The existing API dev script contains POSIX `export`; on Windows use `$env:NODE_ENV='development'`, `pnpm.cmd run build:api`, then `pnpm.cmd run start:api` if a local API is needed.

The actual browser/API bridge requires exactly `postgresql://hint_test:isolated-test-only@127.0.0.1:55439/hint_quality` on that disposable instance. With its migrations applied and no other functional/performance run active, set a fresh `HINT_HANDOFF_OUTPUT`, retain `HINT_QA_BUILD_DIR` and run `pnpm.cmd --filter @workspace/hint exec node scripts/run-app-api-qa.mjs`. It uses ports 5057/5256, real device sessions and guarded fictional records; it stops its own API/preview afterwards. Stop only your own disposable database when finished.

## Continuing safely

Keep the brand “The universe leaves you a letter every day.” Preserve the approved three contributors' work and restrained room transitions. First inspect the transferred application in the phone frame, then reproduce any issue before editing. Use local branches/commits for work and push to this repository; sync those commits back to Mac for interim and final native checks.

Git transfers source, assets, tests, evidence and this handoff. It does not transfer .env, API credentials, Keychain sessions, browser localStorage/IndexedDB, databases, dependencies or private local development conversations/configuration. The new desktop profile can start empty; no Mac user records were deleted or moved.

Windows can be the primary web/API development and browser-test machine. Xcode, iOS Simulator, signing and iOS packaging stay on Mac. Release URLs and Apple Team ID are still unspecified; do not ask repeatedly while independent web work can proceed.

## Continue development on another computer

```text
Continue Hint on the latest merge-home-daily-receipt branch, including runtime commit 3280bcfb5e6975194e2bd1f29479306b3d8425c6 and its following handoff commit. Read HANDOFF_WINDOWS.md and artifacts/hint/docs/ios-acceptance-2026-09-29/README.md first. The Mac had confirmed thermal-protection sleep, and I asked to save progress until Windows is ready. Do not start a long Mac run. Use the older merge report only as historical evidence.
The three-way merge is implemented: my Tarot/Astrology/data functions, Xiaoyu's Home/Daily/navigation visuals, and Tiantian's printer as the real sharing dialog. Do not re-import the ZIPs or overwrite with main. Preserve all nine spreads, the 2.8-second two-packet shuffle, fixed daily-card identity, private-by-default immutable receipts, and complete Astrology charts/reports.
Install fresh Windows dependencies, restore the selectable iPhone-frame preview, and continue only unfinished functional/performance checks. The receipt long-frame repair, full-size PNG equivalence, dark/large-text fixes and real browser/API/DB bridge are recorded. Three SE references were reviewed individually; do not bulk-update other screenshots. Preserve source/data safeguards.
The active goal includes Simulator, physical-iPhone acceptance and a prepared signed TestFlight candidate. Use one worker and durable progress logs; verify source/build fingerprints before resuming. Finish consolidated coverage and retain separate Simulator/device/build evidence. Missing Xcode, real HTTPS configuration, signing or device proof prevents completion. Do not mark the expanded goal complete from browser checks or upload TestFlight.
No deployment, TestFlight, paid provider calls, real-data changes, schema push, or copying credentials/browser databases. Keep native iPhone verification separate and show actual phone-frame evidence.
```
