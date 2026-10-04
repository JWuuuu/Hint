# Tarot Room verification — September 8, 2026

Result: no new product defect reproduced in this audit. The existing Tarot fixes
pass the current automated browser matrix. Native release readiness remains
unverified; the gates below still prevent calling the complete app deploy-ready.
The user clarified that this pass should double-check existing work. No product
code, visual baselines, or unrelated features were changed, and nothing was
published, deployed, or submitted.

## Fresh verification

| Check | Result |
| --- | --- |
| Tarot unit/component/adapter suite | 261 passed in 17 files |
| Tarot API suite | 17 passed in 2 files |
| Workspace typechecks | Passed, frontend/API/shared libraries |
| Production web build | Passed; existing main-chunk size warning remains |
| Production API build | Passed |
| Production WebKit phone matrix | 117 passed, 3 intentional skips, 0 failures; 9.3 minutes |
| Selectable hardware-frame preview | 2 passed, 2 intentional duplicate skips; 7.8 seconds |
| Capacitor iOS source preflight | Passed |
| Native speech Swift syntax parse | Passed |
| Whitespace validation | Passed |

The production suite used Pro Max 440 × 956 and SE 375 × 667 touch-enabled
WebKit contexts. No retries, relaxed assertions, or baseline updates were used.
Its three skips are deliberate: frame pacing and the five-ritual soak run once
on Pro Max; the keyboard-height regression runs on SE. Both hardware-preview
tests switch between the two frames, so their duplicate SE invocations skip.

## What the passing matrix demonstrates

- Full question → recommendation → room setup → 78-card wash → automatic cut
  and post-cut shuffle → compact/expanded/pinch arc → reveal → structured
  reading and follow-up → save → History detail/resume → receipt journey on
  both sizes, including refresh during selection and restored reading/chat.
- Manual wash requires movement; cancelled gestures stay in the wash stage;
  rapid Auto Wash advances once; idle wash stops repainting. Interruption,
  background/foreground, and reopened browser-page recovery pass.
- All nine spreads have readable recommendation layouts and contained reading
  cards on both sizes. Visual comparisons cover all three room backgrounds,
  all three card faces, representative backs, arc layering, and 1/3/5/7/9-card
  reading layouts. This is representative coverage, not every possible
  spread/theme/back combination through every ritual stage.
- Both system and Hint reduced-motion modes finish promptly. The browser
  frame-pacing and five-consecutive-ritual checks pass.
- Accessibility and minimum touch targets pass for the tested journey surfaces;
  the SE composer remains visible in a keyboard-sized viewport.
- Pending/local/server-local readings restore with explicit retry. Late
  responses do not replace settled readings. Failed saves retain reading/chat
  for retry; newer fallback storage wins; damaged saved metadata retains cards.
- Offline/stalled follow-ups recover, persist, and restore; leaving a pending
  request cancels it before History resumes.
- Receipt preview and PNG omit question/private answer context by default and
  omit chat with either question setting. Opt-in and subsequent opt-out both
  pass. English 1/3/5/7/9-card and long Traditional Chinese nine-card exports
  retain full text and readable artwork without overlap.
- Voice unavailable/completed UI and share cancellation pass in the browser;
  adapter tests cover native integrations. These are not device permission or
  share-sheet validation.

Selected fresh screenshots were inspected visually: Pro Max three-card spread,
SE nine-card spread and scrolled action/safe area, and a three-card receipt PNG.
Tarot routing and receipt generation remain dynamically imported in source.
The main app bundle still emits a size warning; that was not changed during
this audit.

## Remaining release gates

1. `VITE_HINT_DOWNLOAD_URL` is still unset. `mobile:build` correctly stops before
   packaging. The generated browser-test QR targets the local test origin, so
   this run does not validate a real public download destination.
2. This Mac selects `/Library/Developer/CommandLineTools`; full Xcode,
   `xcodebuild`, and the iPhone Simulator SDK are unavailable. The native build
   preflight confirms this blocker. Swift syntax parsing is not an iOS build.
3. Configure the real URL, build/sync the current Capacitor bundle, then run
   Simulator and physical-iPhone validation from `tarot-ios-release-checklist.md`.
   Real keyboard/safe-area behavior, microphone permissions/dictation, native
   haptic feel, share sheets, lifecycle, and hardware performance remain open.
4. Phone tests use controlled API responses. Live-provider quality, latency,
   credentials, and deployment-environment behavior were not verified here.

Native copied assets are older than the tested web build:

- Tested web `index.html` SHA-256:
  `70867a0ead2a15c1d7d20a8fbffc3b579cbcd7acba4dd769d19ddea85fd46b8a`
- Existing iOS copied `index.html` SHA-256:
  `e2fdf6cc07727e3b7fd0f415bc08895da0a872dfccc498c8cc1d956b6918da98`
- Base Git HEAD: `538081caee67a7c30f2bb84cca61f56c996e8565`.
  This was an existing dirty worktree; HEAD alone does not identify tested code.

## Reproduction and evidence

Run `test:tarot` in both frontend and API packages, workspace `typecheck`, both
production builds, frontend `test:e2e:tarot:production`, and `check:ios:source`.
The standard production port 5181 was already occupied: the first suite launch
stopped before running any tests. A temporary config inherited the production
configuration and used isolated port 5193 and `/tmp/hint-tarot-audit-20260908`
for output. An equivalent development-preview config used port 5194 and
`/tmp/hint-tarot-preview-audit-20260908`. Both temporary configs were removed.
The existing server was left running. `caffeinate -i` kept the Mac awake during
these checks. Raw screenshots and receipt PNGs remain in those temporary output
folders; this document is the durable result record.

Node was supplied through the bundled runtime because the initial shell PATH
could not resolve it. No runtime installation or project dependency change was
needed.
