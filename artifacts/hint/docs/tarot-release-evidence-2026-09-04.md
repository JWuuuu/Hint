# Tarot Room Release-Candidate Evidence

Last verified: 2026-09-08 (America/Chicago)

Status: Web verification now includes the built production application, bounded follow-up requests, IME-safe sending, and newest-session recovery after storage failure. Native release validation remains pending on the external gates listed below; the overall release-candidate goal is not complete. No deployment, store submission, or publication was performed.

## September 8 Receipt Layout Follow-Up

- Exported receipts now use at most three readable columns, centered partial
  rows, full card names and position labels, balanced long titles, and complete
  English/Chinese text. Paper height grows with the content instead of clipping
  the final lines. The animated printer preview and privacy consent behavior are
  unchanged. Oversized/invalid exports fail clearly rather than losing cards or
  allocating an unlimited canvas.
- Current frontend suite: 243 tests pass in 17 files. This includes 19 new
  receipt text/grid checks. Frontend typecheck, the final production build, and
  `git diff --check` pass. The final main entry is `index-M9bQG0Oc.js`; receipt
  generation remains a separate lazy chunk, `shareReceipt-Jk1z9ajX.js`.
- Added actual-PNG browser checks for 1/3/5/7/9-card exports and a nine-card
  Chinese reading on both phone sizes. They assert complete text, measured text
  and artwork bounds, minimum artwork size, exact card count, row count, and no
  overlapping rectangles. Export width stays 1800 pixels; height is now content
  dependent, between 2800 and 8192 pixels. The nine-card Chinese fixture is
  1800 x 4518 pixels.
- Before the last title-only polish, two 18-check attempts each completed 16
  checks. One obsolete fixed-height expectation was updated for the new paper
  contract; subsequent failures occurred at different pre-export waits with
  multi-minute host pauses. The full journey passed on both phones in the
  second attempt. Do not combine attempts into an uninterrupted suite pass.
- A later build had a separate genuine startup failure: its JSX runtime was
  missing `jsx`. The installed React production runtime file was absent. It was
  restored from React 19.1.0's registry archive after SHA-512 verification against
  the unchanged lockfile. Missing regexparam files and an unreadable React DOM
  type declaration were repaired similarly using their exact locked versions.
  No dependency version or manifest was changed in this pass. The invalid build
  was replaced; its interrupted browser run is not passing evidence.
- Final rebuilt-source checks: entry accessibility passes on both phones;
  the complete nine-card Chinese PNG passes on Pro Max and SE; the question
  off/on/off privacy export passes on SE. The final two SE checks passed together
  in 13.6 seconds. A preceding four-check smoke run passed three checks before
  its SE reading-load wait was interrupted. A clean complete regression run
  remains pending on a stable host.
- Final Chinese output was inspected visually. macOS Vision independently
  decoded the exported QR as the controlled test app URL,
  `http://127.0.0.1:5181/app`. This verifies the generated QR, not a configured
  production download destination or a physical iPhone share sheet.
- Final generated evidence is in `/tmp/hint-receipt-final-smoke-20260908` and
  `/tmp/hint-receipt-se-final-20260908`. These temporary files are not durable
  release artifacts. The earlier generated receipt directories may be replaced
  by later test runs.
- The overall goal remains active. Native configuration, full Xcode/Simulator,
  physical-device validation, current native packaging, and live-provider
  latency verification are still required. No deployment or publication occurred.

## Earlier September 8 Verification

- Current frontend suite: 224 tests pass in 16 files, including 26 component
  scenarios. API suite: 17 tests pass in two files. Frontend and API typechecks,
  both production builds, and the local API health check pass.
- Ten focused production WebKit checks pass together in 1.5 minutes across
  SE 375 x 667 and Pro Max 440 x 956. They cover all nine spread layouts,
  swipe/cancellation/no-hover behavior, the complete ritual/reading/History
  journey, receipt image privacy, and a server-generated local fallback that
  survives refresh and can be retried explicitly. This is a focused run, not
  a new full release-matrix certification.
- Saved readings now retain their original structured answer, spread name,
  and position labels when reopened after changing the app language. Follow-up
  requests and retries use those same archived positions instead of replacing
  them with current translations.
- Receipt preparation is owned by the open preview. Closing it or leaving the
  reading aborts pending preparation, prevents a later share-sheet launch, and
  ignores late results. Question consent cannot change while an export is in
  progress. Each native attempt owns a unique temporary file and cleans up only
  that file. Adapter tests cover cancellation during a pending native write;
  this is not physical-iOS verification.
- Missing receipt artwork now fails clearly rather than exporting blank cards.
  The browser checks generate actual 1800 x 2800 PNGs with the question off,
  on, and off again. Canvas text assertions confirm that chat is never printed
  and question-derived answer text is excluded by default. The saved reading
  and chat remain unchanged. Exported artwork and phone screenshots were
  inspected. The long-text/CJK wrapping and nine-card label issues found in this
  pass were addressed in the receipt-layout follow-up above.
- A process sample identified Tailwind scanning generated asset folders. Its
  scan is now explicitly scoped to `src` plus `index.html`, following the
  [official source-detection configuration](https://tailwindcss.com/docs/detecting-classes-in-source-files).
  A parsed CSS comparison found no changed rules; only five unused utilities
  disappeared. A later build stalled separately while clearing an old generated
  folder. The current normal output subsequently built successfully in 29.42s;
  an additional clean temporary output built in 2.01s. No source assets were
  removed or renamed. The existing large main-bundle warning remains.
- The API was rebuilt and restarted. A synthetic one-card live request returned
  an AI result with exact card metadata in approximately 3.2 seconds. A later
  nine-card request exceeded the client's 12-second deadline; the server
  eventually reported provider timeout and local fallback. Host Sleep/DarkWake
  activity may affect elapsed times, but the nine-card live latency gate remains
  unverified. Controlled API tests are not live-provider performance evidence.
- `/app/tarot` on port 5175 and `/api/healthz` on port 5050 are responding.
  Live desktop inspection was unavailable because the Mac was locked; this pass
  uses inspected automated screenshots and does not claim that the visible tab
  was refreshed.
- No deployment, publication, commit, push, or native release certification was
  performed. The external release gates below still apply.

## Earlier Passed Evidence

- Workspace TypeScript: all shared libraries, Hint web, and Tarot API types pass.
- Production build: Hint web and API bundles pass. Tarot receipt generation remains a separate lazy chunk.
- Tarot unit, adapter, and component tests: 126 tests pass in 15 files. The 109 logic/adapter checks cover ritual state and stable-stage recovery, native app-state registration/cleanup, wash physics, interrupted-manual-wash cleanup, cut/deck order, arc geometry, exact card selection, persistence migration and interpretation status, storage failures and damaged metadata, newest-store selection and rapid-save ordering, bounded/cancellable follow-up requests, receipt privacy/layout and delivery, native/browser speech startup cancellation, live system/app reduced-motion preferences, and haptic settings/rate limiting.
- React component coverage: 17 focused scenarios verify unavailable-voice typed fallback, cancellation during delayed microphone startup, natural dictation completion, exact room-settings return with separate Back/Home actions, browser and native iOS foreground recovery, archived reading/chat restoration with durable follow-up persistence, explicit retry for interrupted/offline interpretations, failed-save warnings and durable retry, malformed AI-response fallback, late chat ownership after unmount, and IME confirmation without accidental sending.
- Development WebKit coverage: the preceding 102-check suite passed 97 checks with 5 intentional device-specific skips across iPhone 17 Pro Max and iPhone SE, in 7.8 minutes. After the follow-up fix, six focused development checks passed on both phones. Preview-shell and generated-file gates remain development-only checks.
- Production WebKit coverage: the built application passed 99 checks with 3 intentional device-specific skips across 102 checks, in 8.1 minutes. This run used the chat fixes before the final newest-session recovery change. Frame-pacing and five-ritual gates run once on Pro Max; the keyboard-height gate runs on SE. No failed tests were retried or visual baselines updated.
- Final recovery verification: the latest production build passed all 18 affected phone checks in 2.1 minutes, covering the complete ritual/History/receipt journey, reopened webviews, stalled/departed chat, pending/local interpretation restoration, newest fallback selection and migration, failed-save retry, and damaged archived records on both phone sizes. Workspace typechecks and all 126 unit/component/adapter tests pass for this final source.
- Full journey: question, recommendation, room design, 78-card wash, automatic cut/post-cut shuffle, compact/expanded/pinch arc, reveal, AI reading, follow-up chat, save, History detail, restored chat, Receive preview, privacy opt-in, and receipt download pass on both device sizes.
- Share Receipt artifact: both device journeys verify a valid PNG signature, the intended 1800 x 2800 export dimensions, and a substantial rendered payload; model tests keep chat excluded, keep the private question opt-in, and carry the configured Hint download URL into the QR data.
- Share Receipt delivery: isolated adapter tests verify native cache write/share/cleanup, cleanup after native URI or share failure, quiet cancellation on native and browser share sheets, supported browser file sharing, and browser image-download fallback when support is absent or capability detection fails. Real failures remain errors instead of being mistaken for cancellation.
- Manual wash: a real circular touch drag must cross the movement threshold, has no arbitrary minimum hold time, keeps the release guidance visible, and automatically gathers, cuts, post-cut shuffles, and reaches the unchanged 78-card arc on both device sizes. A deliberately quick intentional wash passes repeatedly on Pro Max while tap-only and cancelled gestures remain rejected on both sizes.
- Recovery: interrupted automatic ritual returns to preparation; browser visibility and Capacitor `appStateChange` both return an interrupted mounted WebView to the stable Prepare stage; selected arc cards survive refresh; closing and reopening the webview restores the nearest stable stage from durable storage; completed reading data and chat restore without regenerating the reading.
- History resilience: malformed stored cards are isolated to their damaged entry, so one corrupt local record can no longer hide valid saved readings from History.
- Storage failure: a failed write keeps the reading and follow-up chat in memory, shows an honest warning, protects navigation, and allows receipt export. Explicit retry persists the same reading ID, full answer, chat, cards, and room design; both phone sizes verify restoration afterward. An in-memory draft is not a promise of durability after forced app termination.
- Damaged records: unreadable collection roots are not overwritten. Raw damaged entries within a readable collection and another user's matching reading ID are preserved on save/patch. Invalid room metadata is normalized independently, and malformed or card-count-mismatched structured interpretations use a local fallback without changing the selected cards.
- Follow-up lifecycle: leaving the reading aborts its request and prevents a late response from overwriting a newer conversation. A 12-second deadline releases the composer with the existing local fallback; malformed replies cannot create empty assistant messages. The original user message remains saved when leaving mid-request. IME Enter/229 and Shift+Enter do not send the draft.
- Recovery store selection: a reproduced quota failure restored an older durable question instead of the newer session fallback. Loading now selects the newest valid copy, rapid saves receive strictly increasing timestamps, and a successful durable save clears obsolete fallback state. Unit checks cover failed migration, successful migration, ties, corrupt fallback data, and same-millisecond saves.
- Interpretation recovery: new records preserve pending/local/ready status. A refresh during generation or after service failure restores the existing local answer with Retry, without making a new request automatically. Explicit retry updates that same reading and keeps its cards, room design, and conversation; a completed result survives another refresh without regeneration.
- Voice lifecycle: permission/startup cancellation cannot reopen a dismissed microphone session, late callbacks cannot populate the next recording, repeated final results do not duplicate words, and natural completion leaves a usable transcript. The phone sheet distinguishes starting, listening, completed, and unavailable states, with a transform-only waveform and reduced-motion support.
- Performance: Auto Wash frame pacing passes the sustained-stall gate and five consecutive complete rituals pass without increasing delay. The wash table no longer repaints its card transforms every frame while waiting for input or after a rejected/cancelled gesture; both phone sizes verify that it becomes still without breaking manual wash.
- Reduced motion: Tarot now combines the device's Reduce Motion preference with Hint's setting, responds to live preference changes, and removes its listener on unmount. Both settings independently pass a strict three-second Auto Wash-to-arc gate on SE and Pro Max. The normal-motion journey still passes; other consumers of the shared card visual keep their existing default behavior.
- Accessibility: critical/serious WCAG 2.0/2.1 A/AA checks and 44-point touch-target checks pass at entry, recommendation, room setup, wash, arc, reveal, reading, restored History, and the card-detail guidance state.
- Responsive catalog: all nine named spreads render without phone-frame overflow; the current card-left, full-explanation Answer Cards layout is contained at both target sizes.
- Personal Spread: one unframed active preview replaces the oversized blurred carousel. Complete descriptions and recommendation reasons stay in normal flow below the toolbar; all nine spreads, cancelled gestures, swipe navigation, refresh, Back, and setup continuation pass at both phone sizes. Details are in `tarot-spread-layout-evidence-2026-09-07.md`.
- Card detail: Answer Card artwork opens into a gesture-first preview with tap and pinch zoom, no desktop hover movement, no permanent zoom controls, a one-time dismissible usage cue, and one interactive card layer during card-to-card transitions.
- Transition polish: major Tarot stages are serialized so outgoing and incoming screens do not overlap; the cut sequence keeps a readable completion beat before the arc appears.
- Visual regression: 18 WebKit baselines cover all three room backgrounds, all three available card faces, representative card backs, the ordered arc, 1/3/5/7/9-card readings, and the completed voice sheet on both devices.
- Room continuity: selected background, card face, and card back persist through ritual, reading, saved History detail, and restored chat.
- Native source: Capacitor App lifecycle, speech registration, microphone/speech permissions, partial-listener setup cleanup, lifecycle interruption handling, invalid microphone-format protection, main-thread event delivery, Filesystem/Haptics/Share packages, and project source membership pass the static iOS preflight.
- Swift syntax: `HintSpeechRecognitionPlugin.swift` parses with the installed Swift toolchain.
- Native assets: the prior bundle was copied to iOS and Android without a placeholder receipt download URL. Those copies are not current with the latest web changes; mobile sync must be rerun after the real download URL is configured.
- API health: `/api/healthz` returns HTTP 200 with `{"status":"ok"}`.
- Worktree integrity: `git diff --check` passes, and unrelated dirty files were not reverted.

## September 7 Audit Notes

- The initial full run returned 79 passes, 3 failures, and 4 device-specific skips. Traces showed unrequested development-page reloads during the failed voice, late-response, and repeated-ritual checks. A later targeted trace also captured a delayed development-server restart after its configuration changed.
- Native packaging was confirmed to emit unnecessary live-reload messages. The development watcher now ignores native output and test artifacts, and dependency scanning starts only at the web entry. The test server has a separate cache and disables live reload/file watching so outside edits cannot invalidate an in-progress journey. Test timeouts and visual baselines were not loosened to pass the failures.
- Those reloads exposed a real recovery gap: the archive did not distinguish unfinished/local interpretations from completed ones. The new persisted status and explicit retry checks address that product defect independently of test-server isolation.
- The earlier media-only reduced-motion test proved completion but not speed. Source inspection showed that JavaScript timers were reading only Hint's preference. A Tarot-scoped reactive preference now honors either setting; the replacement tests enforce elapsed time without reducing the 78-card logical deck.
- Earlier in this audit, production web/API builds, workspace typechecks, 96 Tarot tests, static iOS preflight, Swift syntax parse, and Capacitor sync passed. The then-current copied web entry was identical in web, iOS, and Android builds: SHA-256 `e2fdf6cc07727e3b7fd0f415bc08895da0a872dfccc498c8cc1d956b6918da98`.
- After the layout and persistence changes, production web/API builds, workspace typechecks, 111 Tarot tests, the 102-check WebKit matrix, static iOS preflight, and Swift syntax parsing pass. The new web entry SHA-256 is `0d96b46c570352305b79ad694a3e691beb1688b22d3c2554e4e8c639cc610ee5`; Capacitor sync was not rerun, and the iOS copy still has the earlier hash.
- A cold development dependency-cache run previously encountered a duplicate-React hook error. The new `check:tarot:startup` gate passed six isolated empty-cache starts (three per phone) and six warm restores with normal dependency discovery/HMR, no unrequested reload, and no runtime/server error. Each start completed question, spread selection, Auto Wash, and restored the arc. The original cause was not reproduced; this is repeatable current evidence, not a claim to have identified that historical cause.
- Following the request-lifecycle update, a production bundle with entry SHA-256 `3c37ed7c776736d8fc09bc3242570999ab01f5c8e645eb5d2092be42ebe288b1` passed the full 102-check production matrix above. The final newest-session change was built separately; its current entry is `24cbb783cc756c90b935946178a381b475f4d10cf801491f6259815a8a04534f`. Native copies remain older and must be resynced after configuring the real download URL.
- The app remains open in the selectable iPhone 17 Pro Max frame at `http://127.0.0.1:5175/app/tarot`. This is responsive browser evidence, not physical-iPhone certification.

## External Release Gates

1. Configure a real public Hint download or App Store URL as `VITE_HINT_DOWNLOAD_URL` in `.env.mobile` or the mobile build environment. `mobile:sync` intentionally fails before packaging when this is absent.
2. Install/select full Xcode with the iPhone Simulator SDK. The current machine is using `/Library/Developer/CommandLineTools`, so `xcodebuild` and `iphonesimulator` are unavailable.
3. After both gates are available, run `pnpm --filter @workspace/hint mobile:ios:check`, then complete every physical-device item in `docs/tarot-ios-release-checklist.md`.

Browser suites use controlled profile/AI responses to verify client behavior, not provider output quality or live-service latency. The production suite serves the actual minified files and image assets, but it is still WebKit automation rather than native iPhone proof. Live provider checks and native permission, haptic, share-sheet, keyboard, and lifecycle evidence remain separate requirements before release.

## Reproduction Commands

```sh
pnpm --filter @workspace/hint test:tarot
pnpm --filter @workspace/hint test:e2e:tarot
pnpm --filter @workspace/hint test:e2e:tarot:production
pnpm --filter @workspace/hint check:tarot:startup
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/hint check:ios:source
pnpm --filter @workspace/hint mobile:ios:check
```
