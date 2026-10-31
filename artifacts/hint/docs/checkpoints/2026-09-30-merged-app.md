# Hint merged App checkpoint — 2026-09-30

This is a saved development checkpoint, not a release approval. The three contributors' agreed changes are integrated; final same-version regression and native acceptance remain incomplete. The owner requested this checkpoint after viewing the merged Home screen.

## Exact version

| Item | Recorded value |
| --- | --- |
| Repository | `https://github.com/JWuuuu/Hint.git` |
| Working branch | `merge-home-daily-receipt` |
| Annotated checkpoint tag | `checkpoint-2026-09-30-merged-app` |
| Commit before this documentation checkpoint | `1b630d02bcd7db652cfba7a0f0532880d9c1986c` |
| Latest application implementation commit | `3280bcfb5e6975194e2bd1f29479306b3d8425c6` |
| Source/test fingerprint | `092a37b05f85b12b5884f8d83929a4ff6b5935f103bb8c8c7f4e5ac753c9b32e` |
| Built web-assets fingerprint | `cd5d14ee0baacb51c4dd619e2bfc8d402a4cb973559fd351d53e04e64ece197c` |
| Verification time | `2026-09-30 15:32:12 UTC` |

Fingerprints were recalculated with `scripts/qa-progress-reporter.cjs`. Before the checkpoint edits, the working tree was clean and the local commit matched the live GitHub branch. The checkpoint tag identifies the following documentation commit; runtime source, assets and tests are unchanged. `main` and `windows-handoff-2026-09-12` are unchanged.

## Included work

- Functional baseline: nine Tarot spreads, fixed card identities and orientations, Wash → three-pile Cut → **2.8-second two-packet Shuffle** → Pick → Reveal → Reading, follow-ups, save/history, Astrology charts/reports, local identity and data safeguards.
- Xiaoyu / 小宇: Home and Daily composition, typography, date selection, scores, room entries and navigation appearance.
- Tiantian / 甜甜: receipt printer artwork and animation connected to actual Home/Daily/Tarot snapshots, with private-by-default content, PNG preparation, replay, retry and focus restoration.
- Subsequent QA fixes: receipt PNG encoding moved off the UI thread; Home/Daily dark colors, complete detailed Daily copy, enlarged score layout and dark Ask label repaired. Three old SE pick references were individually reviewed and updated with retained comparisons.

The [merge handoff](../../../../HANDOFF_WINDOWS.md) and [acceptance evidence](../ios-acceptance-2026-09-29/README.md) retain the detailed boundaries and test records. No new implementation is included in this checkpoint.

## Current preview

- Mac URL: `http://127.0.0.1:5255/app?hintPreview=frame`.
- Served directory: `/tmp/hint-ios-production-dock-20260929`.
- The Home screen was visibly opened in the selectable **iPhone 17 Pro Max, 440×956** frame. The toolbar also offers SE and other sizes.
- This is a local web preview, not an installed iPhone app. No API/database server was started for this preview; its API proxy points to `http://127.0.0.1:1`. Service-dependent features are not established by opening Home.
- At the owner's request to go directly to Home, only this preview origin's browser setting `hint_onboarding_complete_v3` was set to `1`. No name or birth details were entered. This local onboarding flag is not an account credential and is not part of Git.
- The preview process and `/tmp` build are temporary. Rebuild from source on a new machine using the handoff; do not expect the Mac's running server to transfer through GitHub.

## Validation boundaries

| Evidence | Status and version limit |
| --- | --- |
| Frontend units/components | 703 passed at `e23754b`; not a new full run for `3280bcf` |
| API / temporary PostgreSQL | 66 passed at the earlier QA checkpoint; no real database accessed |
| Home / Daily / receipt matrix | 160 passed on the preceding `6fda3456…` build |
| Actual browser → API → temporary DB | Four journeys passed with fictional data and external providers blocked |
| Receipt worker | Focused functional checks passed; eight PNG pairs retained identical decoded pixels; ten browser samples had no frame gap ≥100 ms |
| Dark Ask-label correction | Explicit before-fail / after-pass check and build recorded for the current implementation |
| SE pick references | Three individual reviews retained old/actual/diff images; six normal snapshot comparisons passed |
| Consolidated 922-case run | 110 passed, eight skipped, one timeout, one interrupted, 802 not run; incomplete and predates the last ink fix |
| Simulator / actual iPhone / signed archive | Not completed |

The interrupted Astrology screenshot coincided with a documented 442-second Mac thermal-protection sleep; that case passed three isolated rechecks. This does not prove that every previously reported reset had the same cause. No extended regression, rebuild, performance run or native test was performed to create this documentation checkpoint.

The source/native checks last recorded on 2026-09-29 still list full Xcode/SDK, production HTTPS configuration, Apple Team/signing and physical-device evidence as unresolved. These prerequisites were not rechecked or resolved by this checkpoint. Browser evidence cannot replace native acceptance.

## Paused Goal and next steps

The Goal remains **paused**, as explicitly requested by the owner while Windows is not ready. Starting a local preview and saving a checkpoint do not resume it. The latest approved plan requires browser, Simulator and actual-iPhone evidence plus a prepared candidate; any older browser-only wording in the Goal metadata is superseded by that plan.

When the owner explicitly resumes:

1. Use the latest integration branch and read `HANDOFF_WINDOWS.md`; preserve the three-way merge and do not re-import either ZIP or replace it with `main`.
2. Install fresh Windows dependencies (Node 24.x, pnpm 11.5.0), then run the selectable phone-frame preview. Git does not transfer `.env`, credentials, local profiles/history, databases or Mac dependencies.
3. Run a fresh consolidated functional suite for the current source, then performance separately, with one worker and durable per-test records. Do not skip previously passed selectors from the interrupted run because its source/build differ.
4. Complete the SE nine-spread journeys and review every failure/skip. Run units, API/temporary-DB, types and builds again for the final implementation.
5. Return verified source to Mac for full Xcode/Simulator, physical-iPhone and signed-candidate checks after their prerequisites are available. Native assets must match the verified mobile build.

Do not deploy, upload TestFlight, use paid providers, send invitations or modify real records. The user chose to keep this work on the integration branch; do not merge into `main` as part of resuming tests.

To locate this exact checkpoint without altering the checkout:

```sh
git fetch origin --tags
git show --no-patch checkpoint-2026-09-30-merged-app
```

For future work from the exact checkpoint, first preserve any current uncommitted changes, then create a new branch from that tag rather than resetting or overwriting existing work. The full Windows startup and test commands are in `HANDOFF_WINDOWS.md`.
