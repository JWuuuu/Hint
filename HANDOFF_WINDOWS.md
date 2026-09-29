# Hint Windows handoff — three-way merge, 2026-09-29

Continue the merged application, rather than importing either ZIP over it.

**Active goal expanded on 2026-09-29:** the owner requires actual iPhone acceptance and a prepared TestFlight candidate, without uploading. Browser acceptance is only the first layer. Continue `artifacts/hint/docs/ios-acceptance-2026-09-29/README.md`; Simulator, physical-device evidence and a signed candidate are required before the goal can be complete. The merge evidence below is historical evidence for its exact revision, not an iPhone release approval.

- Repository: https://github.com/JWuuuu/Hint-App.git
- Integration branch: `codex/merge-home-daily-receipt`
- Validated implementation commit: `2f6c1962aa0cee608ec536daa835148fc3a7d98a`
- The following documentation commit adds acceptance evidence only. Use `git log -1` for the exact branch tip.
- Original handoff remains untouched: `codex/windows-handoff-2026-09-12` at `b9594adf2f4d3114cf8bc33d6cd319d123477a13`.
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

## Evidence and stopping point

Read `artifacts/hint/docs/merge-2026-09-28/README.md`, then `validation.json`, `performance.json`, `protected-core.json`, `runtime-manifest.json` and the phone screenshots. These supersede the incomplete 2026-09-12 acceptance status; the old Astrology documentation is retained for architectural context.

The runtime source/asset manifest SHA-256 is `c9a736697b7cc2c5dfa480d3bfcd4a78d9e1e40ab32fbe0a4b9502a6ce42c6ac` (928 files, excluding tests/docs/build output).

Acceptance is complete for this merge scope: 695 frontend unit/component tests and 66 API/disposable-database tests passed; types and frontend/API builds passed. The 612 functional browser cases recorded 586 passes, 23 planned skips, and the three pre-existing SE golden failures described below. Sequential performance passed 5/5 baseline cases and 9/9 merged cases, including five Tarot rituals (16.2–16.5 seconds each, no progressive slowdown). Completed results survived interruptions; only unfinished cases were resumed against the same build.

The merged common-flow frame-gap p95 values were 22–28ms in these browser samples. Receipt preparation/printing/replay had p95 18ms and a 23ms click-to-next-frame observation, but also one isolated 183ms frame gap. Keep that spike as a Windows/physical-iPhone follow-up; the exact phase has not been isolated and this is not a no-stutter guarantee. Heavy test runs are finished on this Mac. To resume after another app interruption, inspect the recorded evidence before scheduling anything again; use one worker for initial desktop checks and all performance runs.

Known validation distinction: three SE pick-screen repository goldens predate the original functional checkpoint. Both the separately built original commit and this merge fail those three old goldens; their actual pixels match each other exactly. `legacy-golden-comparison.json` records this. The old golden files were not overwritten. Keep the recorded failures separate from passed functional tests, and do not claim the entire snapshot suite is green.

Mac browser evidence does not establish physical-iPhone or Windows results. Native sharing, keyboard/IME, haptics, voice, lifecycle, signing, production HTTPS URLs and Apple Team ID remain release gates. No deployment, TestFlight upload, paid provider calls or real account/database changes were made.

## Windows checkout and tools

Use a short path and a fresh dependency installation. Do not copy Mac node_modules or browser binaries.

```powershell
git clone -c core.autocrlf=false --branch codex/merge-home-daily-receipt https://github.com/JWuuuu/Hint-App.git C:\dev\Hint-App
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

The clone keeps LF line endings for the recorded source hashes using a repository-local setting. Use Node 24.x (`.node-version`) and pnpm 11.5.0 (`package.json`). `.cmd` avoids PowerShell launcher-policy problems without changing execution policy. Restart desktop Codex if its PATH has not picked up newly installed tools.

## Isolated app preview

```powershell
$env:HINT_TAROT_E2E = '1'
$env:API_PROXY_TARGET = 'http://127.0.0.1:1'
$env:HINT_E2E_BASE_URL = 'http://127.0.0.1:5254'
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP 'hint-merge-windows'
pnpm.cmd run build:web
pnpm.cmd --filter @workspace/hint exec vite preview --host 127.0.0.1 --port 5254 --strictPort
```

Leave that terminal running. Open `http://127.0.0.1:5254/app?hintPreview=frame`; select SE 375×667 or Pro Max 440×956. `/app/tarot?hintPreview=frame` and `/app/astrology?hintPreview=frame` open those rooms directly. This preview deliberately has no live API. Automated fixtures exercise real UI with fictional cards/readings/charts and block unmocked API requests.

From another terminal, set the same `HINT_E2E_BASE_URL` and a new `HINT_HANDOFF_OUTPUT`, then run:

```powershell
$specs = @('merge-receipt','daily-text-layout','daily-history-periods','home-motion',
  'tarot-all-spreads','tarot-room','tarot-spread-navigation','tarot-wash-refinement',
  'astrology-reports','astrology','astrology-creation','astrology-quality',
  'quality-recovery','quality-gap-regressions','room-fresh-entry','room-visits',
  'room-entrances','space-navigation','me-redesign','navigation-text-layout','touch-targets') |
  ForEach-Object { "e2e/$_.spec.ts" }
pnpm.cmd --filter @workspace/hint exec playwright test @specs --config playwright.handoff.config.ts --workers=2 --grep-invert 'native packaging|sustained animation stalls|five consecutive rituals|host frame samples|host RAF sample|printer frame sample'
```

Run performance separately after functional tests, with no other heavy browser tests:

```powershell
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP 'hint-merge-windows-performance'
pnpm.cmd --filter @workspace/hint exec playwright test e2e/motion-performance.spec.ts e2e/room-entrances.spec.ts e2e/tarot-room.spec.ts e2e/merge-receipt.spec.ts e2e/astrology-quality.spec.ts --config playwright.handoff.config.ts --workers=1 --project iphone-17-pro-max --grep 'web frame regression|host RAF sample|sustained animation stalls|five consecutive rituals|printer frame sample|host frame samples'
```

The native watcher test is excluded because it writes temporary native packaging files. Font rasterization and browser performance differ on Windows; inspect geometry and content before treating pixel differences as app defects. Do not update snapshots just to make failures disappear.

For API/DB tests, create a **disposable PostgreSQL 18 database**. Set its `DATABASE_URL` and `HINT_ISOLATED_DB=1`, clear paid-provider keys, then run `pnpm.cmd --filter @workspace/db run migrate`, `migrate:check`, and `pnpm.cmd --filter @workspace/api-server exec vitest run --maxWorkers=1`. Do not use `db:push` or a real database. The existing API dev script contains POSIX `export`; on Windows use `$env:NODE_ENV='development'`, `pnpm.cmd run build:api`, then `pnpm.cmd run start:api` if a local API is needed.

## Continuing safely

Keep the brand “The universe leaves you a letter every day.” Preserve the approved three contributors' work and restrained room transitions. First inspect the transferred application in the phone frame, then reproduce any issue before editing. Use local branches/commits for work and push to this repository; sync those commits back to Mac for interim and final native checks.

Git transfers source, assets, tests, evidence and this handoff. It does not transfer .env, API credentials, Keychain sessions, browser localStorage/IndexedDB, databases, dependencies or private Codex conversation/configuration. The new desktop profile can start empty; no Mac user records were deleted or moved.

Windows can be the primary web/API development and browser-test machine. Xcode, iOS Simulator, signing and iOS packaging stay on Mac. Release URLs and Apple Team ID are still unspecified; do not ask repeatedly while independent web work can proceed.

## Paste into desktop Codex

```text
Continue Hint on codex/merge-home-daily-receipt, starting from validated implementation commit 2f6c1962aa0cee608ec536daa835148fc3a7d98a and its following evidence commit. Read HANDOFF_WINDOWS.md and artifacts/hint/docs/merge-2026-09-28/README.md plus validation.json/performance.json first.
The three-way merge is implemented: my Tarot/Astrology/data functions, Xiaoyu's Home/Daily/navigation visuals, and Tiantian's printer as the real sharing dialog. Do not re-import the ZIPs or overwrite with main. Preserve all nine spreads, the 2.8-second two-packet shuffle, fixed daily-card identity, private-by-default immutable receipts, and complete Astrology charts/reports.
Install fresh Windows dependencies, restore the selectable iPhone-frame preview, and run the isolated functional and sequential performance checks in the handoff. Review the three pre-existing SE golden mismatches using the recorded baseline comparison; do not hide them with snapshot updates. Continue from reproduced issues and retain source/data safeguards.
The original three-way merge is complete; the owner then expanded the goal to full App quality plus Simulator, physical-iPhone acceptance and a prepared signed TestFlight candidate. Read artifacts/hint/docs/ios-acceptance-2026-09-29/README.md for the active work. Do not re-import archives. First verify the checkout and a small phone-frame smoke test; use one worker and durable progress logs. Finish omitted coverage and the isolated receipt frame-gap investigation, then retain separate Simulator/device/build evidence. Do not mark the expanded goal complete from browser checks or upload TestFlight.
No deployment, TestFlight, paid provider calls, real-data changes, schema push, or copying credentials/browser databases. Keep native iPhone verification separate and show actual phone-frame evidence.
```
