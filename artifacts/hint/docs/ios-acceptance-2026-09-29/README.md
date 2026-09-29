# Hint iPhone acceptance — active, not complete

The user's approved iPhone plan supersedes the earlier browser-only stopping point. The three-way merge starts at `387a15268ea3341e2d03d19dd8ee11b743a6e87c`; its browser evidence remains valid for that implementation, but does not prove Simulator or physical-iPhone acceptance.

## Completion gates

1. Preserve all three contributions and Tarot's nine spreads, fixed card identity, privacy, persistence and 2.8-second shuffle. Reproduce defects before correcting them.
2. Complete omitted whole-app tests, the expanded phone/theme/locale/motion/text matrix, actual visual inspection and isolated browser/API/database journeys.
3. Resolve the receipt frame spike and review the three stale SE visual references with before/after evidence.
4. Build the verified web revision into the iOS application; pass Simulator and at least one actual iPhone's keyboard/IME, touch, share/cancel, haptics, denied speech permission, offline, background, lock and restart checks. Record model, OS, build and source revision.
5. Prepare a signed, reviewable TestFlight candidate and test information. Do not upload, publish, send invitations or use paid providers/real records.

Missing native evidence prevents completion. Windows and browser results are not iPhone proof.

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

Safari 16.4 introduced 2D OffscreenCanvas worker support ([WebKit release notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)); runtime feature checks select the compatible path. This support statement does not establish that Hint's worker has passed a physical WKWebView test.

## Low-load continuation

One worker, one test/build/performance task at a time. Do not stop unrelated services. Before resuming after interruption, check the original process handle and preview process rather than assuming they died.

Set `HINT_HANDOFF_OUTPUT` to a new temporary directory and `HINT_QA_BUILD_DIR` to the exact served production directory. `playwright.handoff.config.ts` records each completed test immediately in `progress.jsonl`, including source/test and asset fingerprints. For an interrupted run:

```text
node scripts/qa-resume.mjs /absolute/path/to/progress.jsonl
```

Use the original selection with the printed `--test-list-invert` argument and a new output directory. Only completed passes are omitted; skips, failures and interrupted tests remain. Changed source/tests/assets reject resumption. The log is evidence, not proof a process is still running.
