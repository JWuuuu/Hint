# Hint iPhone acceptance — active, not complete

The user's approved iPhone plan supersedes the earlier browser-only stopping point. The three-way merge starts at `387a15268ea3341e2d03d19dd8ee11b743a6e87c`; its browser evidence remains valid for that implementation, but does not prove Simulator or physical-iPhone acceptance.

## Completion gates

1. Preserve all three contributions and Tarot's nine spreads, fixed card identity, privacy, persistence and 2.8-second shuffle. Reproduce defects before correcting them.
2. Complete omitted whole-app tests, the expanded phone/theme/locale/motion/text matrix, actual visual inspection and isolated browser/API/database journeys.
3. Resolve the receipt frame spike and review the three stale SE visual references with before/after evidence.
4. Build the verified web revision into the iOS application; pass Simulator and at least one actual iPhone's keyboard/IME, touch, share/cancel, haptics, denied speech permission, offline, background, lock and restart checks. Record model, OS, build and source revision.
5. Prepare a signed, reviewable TestFlight candidate and test information. Do not upload, publish, send invitations or use paid providers/real records.

Missing native evidence prevents completion. Windows and browser results are not iPhone proof.

## Latest stop: Mac thermal sleep, long tests deferred

The current runtime has one additional dark-dock label fix after the `e23754b` unit/API/matrix checkpoint: Ask uses the night foreground instead of dark action-button ink. Its explicit regression failed before and passed after; see [before](./dock-ink-before-registry.json), [after](./dock-ink-after-registry.json) and the [corrected SE screenshot](./samples/se-es-dark-dock-after.png). The latest production asset fingerprint is **`cd5d14ee0baacb51c4dd619e2bfc8d402a4cb973559fd351d53e04e64ece197c`**, in `/tmp/hint-ios-production-dock-20260929`, served on the isolated 5255 preview. Earlier `6fda3456…` results are prior-checkpoint evidence, not a final full pass of this new fingerprint.

A 922-case consolidated browser run was interrupted for this review. It recorded 110 passes, eight scope skips, one timeout, one interrupted case and 802 not run ([registry](./interrupted-app-registry.json)). The timeout coincides with an actual **Thermal Emergency Sleep**: the Mac slept for 442 seconds while a screenshot awaited completion for 440.8 seconds. The same Astrology case then passed three isolated repeats ([recheck](./astro-timeout-recheck-registry.json)). [System/trace correlation](./mac-interruption.json) is preserved; it does not establish that all earlier reported resets had the same cause.

Long Mac test runs are stopped pending a suitable host. No thermal or power protection was overridden. Continue the full suite and standalone performance on Windows when available, with the current source/assets; **do not resume this older run by omitting its passed selectors after source changed**. No claim of whole-app, physical-iPhone or TestFlight acceptance is made.

## Current evidence and prerequisites

- Baseline omitted Journal suite: **10/10 passed** on both phone sizes against the unchanged merge production build. Fictional fixtures; `/tmp/hint-ios-qa-journal-20260929/results.json` and durable per-test log retain details until copied into the final evidence package.
- No connected USB iPhone was found during the initial inventory. Device and signing availability requested from the user.
- Full Xcode is not selected/available; only Command Line Tools are selected. Simulator/device builds are not validated.
- Mobile release configuration fails on missing `VITE_API_BASE_URL`; real HTTPS public/download URLs, associated domain and Apple signing details still require verification. Placeholder values must not bypass release checks.
- Baseline omitted personality/share suite: 12/20 initially passed; eight Tarot checks still targeted the retired receipt controls. Updating those assertions to inspect the actual public PNG, translated labels, reversed pixels and default privacy produced **20/20**. This corrected stale tests, not eight product defects.
- Confirmed receipt defect: **10/10 opens** contained a >=100ms frame gap. WebKit's main-thread `canvas.toBlob()` call blocked for **135–164ms**, while card drawing took 4–5ms. See [before](./receipt-profile-before.json).
- The existing renderer now transfers its unchanged pixels to a short-lived PNG worker. Abort, failure and timeout terminate the worker; late bitmap preparation closes its resource. Unsupported browsers keep a cancellable canvas fallback. Related unit/component tests: **36/36**, frontend types and isolated production build passed.
- Ten equivalent exports after this repair: each frame-gap p95 **17ms**, longest gap **49ms**, longest click-to-frame **50ms**, **zero >=100ms gaps**. Full-size PNG encoding still takes 147–174ms but no longer occupies the UI thread. See [after](./receipt-profile-after.json). These measurements are host WebKit evidence; native timing remains unverified.
- Functional and visual regressions on the new production assets are ongoing. Earlier merge results do not substitute for final same-version acceptance.
- Focused production regression after PNG repair: **69 passed / 1 intentional skip** (SE duplicate of primary-device frame sampling). [Exact cases](./receipt-functional-registry.json). Four non-English receipts on both sizes retain **identical decoded pixels** before/after: [eight comparisons](./receipt-pixel-comparison.json), [Spanish before](./samples/tarot-es-before.png), [after](./samples/tarot-es-after.png).
- Home/Daily/receipt matrix: **160/160** passed on production assets `6fda3456e37edd55bbc4d7a6396ba8800509409aef9799c32a26eb35ae121542`. Both phone sizes, five languages, both themes, four motion combinations and 100%/200% web text stress are enumerated in the [case registry](./merge-matrix-registry.json). Each captures top/middle/bottom and PNG preview, checks focus return and footer hitboxes. This is not native Dynamic Type evidence. A later focused dock-boundary assertion also passed; the final consolidated run remains outstanding.
- Actual UI → Express API → PostgreSQL bridge: **4/4 passed**. No fixture credentials or private HTTP responses. Both phone sizes save a real fictional profile and daily note, reload the same card, force a database deletion failure and verify transaction rollback, retry deletion, preserve the profile and draw lock, and prove history does not resurrect. Separate device sessions cannot read/overwrite another profile using a forged anonymous ID. [Case registry](./browser-api-registry.json).
- Complete API/database suite: **66/66 passed**, including 19 persistence, migration and access checks. Six reviewed incremental migrations ran on a fresh temporary PostgreSQL 18 cluster. The cluster was stopped after testing; no existing database was accessed. Migration backup/restore and native deployment readiness are not established by these tests.
- [Nine protected core files](./protected-core.json) remain byte-identical to the functional merge baseline.
- Same implementation: [703 frontend unit/component cases](./frontend-unit-registry.json), [66 API cases](./api-unit-registry.json), both type checks and both production builds pass. Rebuilding web assets reproduced the exact `6fda3456…` fingerprint. The chunk-size advisory remains visible; it is not a device performance result.
- [Native preflight](./native-prerequisites.json): source membership passes, but mobile build remains blocked by missing `VITE_API_BASE_URL`; `simctl` is unavailable with only Command Line Tools selected, and no USB iPhone is visible. No Simulator, device install or archive has been produced.

## Confirmed UI repairs in this batch

| Defect | Reproduction and repair | Evidence |
| --- | --- | --- |
| Dark mode was overridden by cream-route CSS; unstyled status text could be pale on cream | Select dark Home/Daily; use selected-theme tokens for the original composition and inherit matching page ink | Failing palette assertions before repair; [SE Spanish dark Daily at 200%](./samples/se-es-dark-200-daily-top.png) |
| Detailed Daily card explanation was clamped to two lines with no expansion | Open Daily with enlarged text; only interactive previews retain clamping, detail shows its full explanation | Initial full-matrix failures, then all 160 combinations pass |
| Enlarged Home score denominator overlapped the adjacent theme | SE 200%: `/100` extended to x196 while adjacent theme began at x153 | Added geometric separation assertion; [reflowed score and categories](./samples/se-es-dark-200-home-middle.png) |
| Ask label used dark button ink against the dark translucent dock | Open dark Home/Daily/Me; the orb label was much darker than the other tabs | Theme foreground repaired; focused before-fail/after-pass and screenshots retained |

Manual review distinguished the transparent dock's background text from an actual Ask-label overflow. A dedicated label/button/orb-boundary check passed; a separate genuine ink-color defect was then repaired. Navigation behavior remains unchanged. Screenshots are evidence to inspect, not proof that every element was covered by a geometry assertion.

The real-API harness is `scripts/run-app-api-qa.mjs`, with a dedicated Playwright configuration. It requires the exact disposable DB URL and already-built assets, rejects occupied ports, whitelists its child environment, blocks external providers, and binds API/preview to loopback. It deliberately bypasses the API startup module that reads personal `.env` files. Initial harness expectations were corrected for the existing truthful “saved locally” label after reload and the retained-card reopen control; these were not product fixes.

Safari 16.4 introduced 2D OffscreenCanvas worker support ([WebKit release notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)); runtime feature checks select the compatible path. This support statement does not establish that Hint's worker has passed a physical WKWebView test.

## Low-load continuation

One worker, one test/build/performance task at a time. Do not stop unrelated services. Before resuming after interruption, check the original process handle and preview process rather than assuming they died.

Set `HINT_HANDOFF_OUTPUT` to a new temporary directory and `HINT_QA_BUILD_DIR` to the exact served production directory. `playwright.handoff.config.ts` records each completed test immediately in `progress.jsonl`, including source/test and asset fingerprints. For an interrupted run:

```text
node scripts/qa-resume.mjs /absolute/path/to/progress.jsonl
```

Use the original selection with the printed `--test-list-invert` argument and a new output directory. Only completed passes are omitted; skips, failures and interrupted tests remain. Changed source/tests/assets reject resumption. The log is evidence, not proof a process is still running.
