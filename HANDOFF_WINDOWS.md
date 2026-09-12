# Hint Windows handoff — 2026-09-12

## Read this first

The user paused the Mac session to continue on a more powerful Windows desktop. This is a work-in-progress checkpoint, not a release. Continue from the implementation and evidence already in this repository. Do not restart the redesign or overwrite the working state with `origin/main`.

- Repository: `https://github.com/JWuuuu/Hint-App.git`.
- Transfer branch: `codex/windows-handoff-2026-09-12`.
- Mac base HEAD before this checkpoint: `538081caee67a7c30f2bb84cca61f56c996e8565`.
- The remote default `main` was a different commit when inspected. This branch preserves the actual Mac working tree, including earlier uncommitted work. It is intentionally not a merge into main.
- The old `old-hint` remote points at another repository and has a disabled push URL. Use `Hint-App`.
- Latest production web preview was `http://127.0.0.1:5240/app/tarot?hintPreview=frame`, with Astrology at `/app/astrology?hintPreview=frame`. Both preview and test processes are stopped. Port 5237 was an older preview with the shorter shuffle.
- Temporary Mac paths such as `/tmp/hint-pearl-20260912` and `/Users/jwu/.cache/...` are historical evidence locations. Recreate temporary output and dependencies on Windows; they do not exist in a fresh clone.

## User direction and boundaries

Hint's theme is **“The universe leaves you a letter every day.”** Astrology uses Pearl Moonlight: pearl white, mist rose, lavender, champagne details, deep plum in dark mode. Mature, refined, leaning feminine without becoming a game. Keep the existing room identities and restrained feature-entry motion.

Focus is Tarot and Astrology. The larger app repair work is already in this checkpoint; preserve it. Always preview `/app` in selectable iPhone frames: SE 375×667 and Pro Max 440×956. Test actual scroll positions and touch/focus behavior, not just horizontal overflow.

Authorized: finish implementation, reproduce bugs, make the smallest complete fixes, isolated builds/tests, and this GitHub transfer. Do not deploy, upload TestFlight, send invitations, use paid provider tests, modify real accounts/database records, or run schema push. Do not update visual snapshots to conceal regressions. Do not add formal login, cross-device account sync, PDF exports, composite charts, arbitrary-date forecasts, or a new AI report service.

The user has not configured production API/public/install/download HTTPS URLs or Apple Team ID. Native signing, real iPhone evidence, and TestFlight remain blocked on those external requirements. Do not keep asking for the same information during independent web work.

## What was implemented

### Tarot

- After three-pile cut and gathering: a **2.8-second** two-packet shuffle. It opens the packets, brings them close, releases twelve visual card proxies at staggered times, and squares the deck. The hidden 78-card order remains managed by the original flow. Do not replace the draw logic.
- The old 5237 version had a 1.9-second animation; it was difficult to distinguish from gathering. This was a visibility/continuity refinement, not proof that the shuffle code had vanished.
- Preserve the lighter clockwise Wash, continuous gather-to-cut geometry, and reduced-motion shortcut. Normal motion is App reduction OFF and OS reduction OFF; either reduction ON intentionally shortens decorative animation.
- Wash has a readable Dialog explaining that the shuffled deck already contains the cards and a tap reveals the chosen position. Do not claim that shuffling itself is non-random.
- All nine spread diagrams use numbered positions plus complete normal-flow legends, with the single-card legend centered. This fixes SE/200% label clipping and overlap. Arrow targets, swipe ownership, and core drawing are retained.
- Dialog Escape and focus return are verified for the new wash explanation.

Main files: `artifacts/hint/src/modules/tarot/components/TarotRoomFlow.tsx`, `CardWashRitual.tsx`, the Tarot ritual copy resource, and spread recommendation CSS.

### Astrology

- Twelve generated/optimized pearl zodiac illustrations at `artifacts/hint/public/astrology/pearl-zodiac/`; complete sign stories and teaching sections.
- Natal wheel layers, original line SVG zodiac symbols, fixed true data points with separate label collision avoidance, enlarged reading, selection/highlighting, keyboard/list alternatives, and URL restoration.
- Eight-chapter natal letters and six-chapter relationship letters using curated interpretation resources in **en, zh, es, ja, ko**. Each paragraph carries clickable configuration evidence. Unknown data remains unknown. Fallback results cannot become completed personal reports.
- Two-person wheel, individual wheel views, all cross-person aspects, participant names/colors, precise orb and angular separation, enlarged comparison, and full report entry from Together/Compatibility.
- New comparison symbols share the natal SVG paths; raw Unicode zodiac symbols rendered as purple emoji in WebKit and were removed.
- Report modal title and body scroll together, with a fixed accessible Close control. A long-name 200% case formerly reduced the content area to ~12px; both phone sizes now pass that regression.
- Owner-isolated IndexedDB snapshots include inputs, calculations, five-language report text and content version. Saving only succeeds after the transaction completes. Error/retry, offline reopening, immutable historical names/data, identity generations and history-clear generations are covered.
- Relationship covers have a dedicated eyebrow. Unsaved report copy no longer implies persistence.

Main files under `artifacts/hint/src/modules/astrology/`:

- `reportModel.ts`, `interpretationLibrary.ts`, `reportCopy.ts`.
- `reportStore.ts`, `useLetters.ts`, `reportLocation.ts`, `useChartDialogFocus.ts`.
- `components/CelestialReports.tsx`, `ComparisonChart.tsx`, `RelationshipReading.tsx`, `AstrologyGuide.tsx`, `NatalWheel.tsx`.
- Integration: `AstrologyView.tsx`, `TogetherReading.tsx`, `CompatibilityView.tsx`, History/Readings view, `lib/clearHistory.ts`, `lib/astro/normalizeClientAstro.ts`, and Astrology types.

### Backend and data

- `artifacts/api-server/src/modules/astrology/synastryGeometry.ts` calculates cross-person aspects from valid natal longitudes. Policy `hint-angular-v1`: conjunction/opposition 8°, trine/square 6°, sextile 4°.
- Preserve all aspects, person ownership, independent orb/separation/exact angle/allowed orb/source, and raw precision. Composite provider data is not cross-person evidence.
- Natal normalization no longer treats `diff` as orb. Missing and tied element/modality dominance stay unknown; count only actual returned planets, excluding the Ascendant.
- Proxy/cache only reuse successful real comparisons. Invite JSONB result schema 2 stores immutable inputs and synastry; existing private access/consent rules remain.
- OpenAPI and generated client/Zod types were regenerated. The named `AstroSynastryRequest` avoids an Orval inline request-body name collision.
- No new SQL migration in this latest feature batch. Existing six incremental migrations and transaction/access safeguards were tested in a disposable PostgreSQL 18 environment.

## Exact stopping point and verification

Evidence lives in `artifacts/hint/docs/astrology-pearl-2026-09-12/`. Start with its README, `checkpoint-status.json`, report samples, screenshots and the 16-second `tarot-wash-cut-shuffle.webm`.

- Frontend unit/component: **684 passed, 81 files** on the final production implementation.
- API/unit/database: **66 passed, 9 files**, including 19 isolated database integration cases. Later edits only affected frontend presentation/tests/docs; backend source did not change afterward.
- Frontend/API/library typechecks, Orval, frontend/API production builds: passed on Mac.
- Existing six migrations: repeated application, concurrency, rollback, ledger integrity and legacy data retention passed. Cold backup/restore on the same PostgreSQL build matched all 11 table digests and all six migration entries. This is not managed-production PITR evidence.
- Isolated production API smoke: health/readiness, session access, forged-owner isolation, invitation privacy, provider failure, history-clear preservation and revocation passed. That API/database was stopped afterward.
- Final functional E2E scheduled **342** cases. Before the user stopped it: **255 passed, 12 intentionally skipped, 0 recorded failures**. The run is **incomplete**, with 75 cases not recorded as finished. See `e2e-interrupted.txt`.
- Pro Max's complete nine-spread journeys, sharing exports, Astrology matrix and report flows finished in this run. SE was underway. The latest completed line was SE “spread recommendations keep every layout and full explanation in normal flow”; an incomplete process is not a passed full suite.
- Performance sampling and the five-consecutive-ritual soak were intentionally excluded from the parallel functional run and **have not been completed for this final version**. Run them sequentially next.
- A history-clear E2E harness race was fixed: wait for the scheduled main-frame reload before navigating away after successful deletion. This was not another production deletion bug.
- Tarot performance tests now attach frame and duration JSON. Those are test-only additions after the production source freeze.
- No visual snapshots were updated. Browser/WebKit evidence is not physical iPhone proof.
- Whole-checkpoint `git diff --check` still reports whitespace in preserved native config copies, prior patch evidence, generated files and raw test transcripts. These were not reformatted during transfer; the latest Tarot/Astrology production edits passed a scoped diff check. Native duplicate config copies remain a review item for the later native packaging check.
- The new portable Playwright config was checked with `--list` on Mac and discovers the expected 342 functional cases. It has not yet executed on Windows.

## Next work, in order

1. Verify this branch and read the evidence. Install Windows dependencies; do not copy Mac `node_modules` or browser binaries.
2. Rebuild an isolated production preview, restore the iPhone frame, and smoke Tarot and Astrology. All provider requests must remain blocked/mocked for tests.
3. Finish the final functional acceptance command below. On Windows, separate platform font/pixel differences from actual layout defects; retain the Mac goldens and explain differences instead of blindly replacing them.
4. Run the frame sampling and five-ritual soak with one worker and no other heavy browser tests. Record actual p95 gaps and durations, labeling them host/browser measurements.
5. Review SE/top/middle/bottom, long names, 200% text, five languages, dialogs, hitboxes, and chart/report precision. Change production only for reproduced remaining issues, then rerun the affected scope and final integration evidence.
6. Update the quality README/coverage/hash evidence, and show the user the actual phone-frame UI and shuffle clip. Never declare release readiness while native gates remain unverified.

## Windows setup

Use the Windows-native Codex agent and a short local checkout such as `C:\dev\Hint-App`. Node **24.x** is recorded in `.node-version`; package manager is **pnpm 11.5.0** in `package.json`. Git and Node must be available to the desktop app. Restart the app after installing tools if its PATH is stale.

PowerShell examples (run from the repository root):

```powershell
git status --short
git branch --show-current
node --version
npm.cmd install --global pnpm@11.5.0
pnpm.cmd install --frozen-lockfile
pnpm.cmd --filter @workspace/hint exec playwright install webkit chromium
pnpm.cmd run typecheck
pnpm.cmd --filter @workspace/hint exec vitest run --maxWorkers=2
```

`npm.cmd` / `pnpm.cmd` avoid the PowerShell `.ps1` launcher issue without changing machine execution policy. Use the existing lockfile. Do not upgrade dependencies just to make the transfer work.

For an isolated web build and phone preview:

```powershell
$env:HINT_TAROT_E2E = '1'
$env:API_PROXY_TARGET = 'http://127.0.0.1:1'
$env:PORT = '5240'
$env:HINT_E2E_BASE_URL = 'http://127.0.0.1:5240'
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP 'hint-handoff-evidence'
pnpm.cmd run build:web
pnpm.cmd --filter @workspace/hint exec vite preview --config vite.config.ts --host 127.0.0.1 --port 5240 --strictPort
```

Keep that preview running in its own terminal. Open `/app/astrology?hintPreview=frame` and `/app/tarot?hintPreview=frame`. Real personal chart calculation is not enabled in the isolated preview. Test fixtures and saved sample reports exercise the complete UI without paid requests.

From another terminal with the same `HINT_E2E_BASE_URL` and output settings:

```powershell
pnpm.cmd --filter @workspace/hint exec playwright test astrology-reports.spec.ts astrology.spec.ts astrology-creation.spec.ts astrology-quality.spec.ts tarot-all-spreads.spec.ts tarot-room.spec.ts tarot-spread-navigation.spec.ts tarot-wash-refinement.spec.ts room-fresh-entry.spec.ts space-navigation.spec.ts --config playwright.handoff.config.ts --workers=2 --grep-invert 'native packaging files|host frame samples|sustained animation stalls|five consecutive rituals'
```

Then, with the first test process finished:

```powershell
$env:HINT_HANDOFF_OUTPUT = Join-Path $env:TEMP 'hint-handoff-performance'
pnpm.cmd --filter @workspace/hint exec playwright test astrology-quality.spec.ts tarot-room.spec.ts --config playwright.handoff.config.ts --workers=1 --grep 'host frame samples|sustained animation stalls|five consecutive rituals'
```

The native file-watcher test is excluded because it temporarily writes under native packaging folders; the isolated acceptance must not do that. SE skips the nine long journeys and primary-device soak/frame gate by design, while retaining its layout and representative full-flow regressions.

For API database integration, recreate a disposable PostgreSQL 18 database using Windows PostgreSQL or Docker. Use a test database and `HINT_ISOLATED_DB=1`, run incremental `migrate` / `migrate:check`, then API Vitest. Do not reuse a production `DATABASE_URL`, `db:push`, a Mac data directory, or old fixture credentials as production settings. Mac temporary PG ports were 55439 and 55440; neither is a required Windows installation.

## What does not transfer through this Git branch

The branch transfers source, assets, fixtures, committed evidence and this progress record. `.env`, API credentials, Keychain device credentials, local browser storage/IndexedDB, databases, dependencies, build output, and private Codex session/config files are not part of the transfer. The desktop's local beta profile can therefore start empty. The Mac data has not been migrated or deleted.

The twelve optimized zodiac WebP assets and their generation provenance are included. Ignored raw generator output under the Mac `.codex/` folder is not required to run the app.

## Windows and native limits

Use Windows as the primary implementation and browser-test machine; use GitHub commits/branches to synchronize back to the Mac. After major gestures, keyboard, share, or lifecycle changes, do an interim Mac/physical-iPhone check, as well as the final release verification.

Windows supports the web/API development and Playwright browser workflow. Install platform-specific dependencies locally. Font rasterization, media codecs, filesystem paths and browser performance can differ, so reverify those results on Windows. Xcode and the iOS Simulator require macOS; keep this Mac (or another Mac) for signing, native packaging, real iPhone checks and eventual TestFlight work.

Official references checked for this handoff: [OpenAI Windows workflow](https://learn.chatgpt.com/docs/windows/windows-app), [Playwright installation](https://playwright.dev/docs/intro), [Playwright browsers](https://playwright.dev/docs/browsers), [Xcode requirements](https://developer.apple.com/xcode/system-requirements).

## Paste into desktop Codex

```text
Continue Hint from this checked-out branch: codex/windows-handoff-2026-09-12.
Read HANDOFF_WINDOWS.md and artifacts/hint/docs/astrology-pearl-2026-09-12/README.md first. Preserve the implementation already present. We stopped during final Tarot/Astrology production acceptance, not at the start of the redesign.
Set up the project for Windows with Node 24 and pnpm 11.5.0, then restore the selectable iPhone-frame preview. Finish the interrupted acceptance and sequential performance/soak tests described in the handoff. Reproduce any remaining issues before making small fixes.
Keep the 2.8-second two-packet Tarot shuffle and the Pearl Moonlight Astrology illustrations, interactive natal/comparison charts, and complete five-language in-app reports. No deployment, TestFlight upload, real-data changes, paid provider tests, schema push, or snapshot replacement to hide regressions. Continue autonomously and show actual phone-frame evidence.
```
