# Tarot Spread Selection: Layout Verification

## Scope

Refined the Personal Spread screen reported in the September 7 screenshot.
This is a focused layout and interaction update, not a new release certification.
The original pick arc, wash/cut flow, chosen room background, and card-back
selection were not changed by this update.

## Changes

- Removed the fixed-height, overflow-hidden heading block that cut off status labels.
- Replaced the oversized, blurred multi-panel carousel with one unframed spread preview.
- Kept the question, full spread description, reason, and action in normal flow.
- Replaced technical API/confidence badges with a quiet recommendation status.
- Enlarged the one/three-card previews; moved three-card numbering above the artwork.
- Replaced tiny position-label pills for larger spreads with a readable numbered list.
- Kept arrows at 44 pixels with no hover scaling; pointer movement uses a MotionValue
  rather than rerendering every spread on each pointer event.
- Preserved swipe navigation, cancelled-gesture handling, and reduced-motion behavior.
- Added a local reason fallback when a restored recommendation has an empty reason.
- Kept the scrolling content below Back/Home/settings, including on the SE frame.

## Visual Polish Follow-Up: September 8

- Made the selected spread name the single editorial heading, removing the
  repeated title below the cards.
- Styled the question as an understated serif quotation with a dusty-rose rule.
- Grouped recommendation status and spread pagination on one line.
- Enlarged the one/three-card artwork, with a responsive three-column layout,
  readable numbering and position labels, and lighter shadows.
- Kept larger-spread geometry intact; removed the pill treatment from the
  smaller inline position labels.
- Centered the general spread description and kept the personal explanation
  and CTA in normal flow. Added a thin arrow to the CTA.
- Kept all changes limited to the recommendation presentation. No arc, wash,
  cut, reading-generation, archive, or room-background behavior was changed.

Verification for this follow-up:

- Frontend typecheck, all 126 Tarot unit/component/adapter tests, production
  build, and `git diff --check` passed.
- Development phone checks: 7 passed, 1 intentional duplicate frame-test skip.
- Added assertions for a single heading, expected artwork count, artwork
  containment, readable position labels, and single-line English status text.
- Final production checks passed individually on both SE and Pro Max, including
  all nine layouts, swipe/cancel/refresh/Back, accessible touch targets, and
  continuation into setup. No uninterrupted six-test production run was
  obtained: successive runs completed 5/6 checks with timeout failures at
  different points. A headed rerun was also interrupted.
- Traces contain long pauses between operations; macOS power logs confirm
  Sleep/DarkWake cycles during those runs. Keep an uninterrupted production
  rerun pending rather than treating these attempts as a clean suite pass.
- Screenshots were inspected at 375 x 667 and 440 x 956. Small-screen content
  scrolls naturally, and the CTA remains reachable above the safe area.
- The live `/app/tarot` route returned HTTP 200 and remains in the selectable
  iPhone 17 Pro Max frame.

## September 8: Focused Presentation Pass

- Moved carousel navigation below the artwork, keeping the card count next to
  the recommendation status and the spread index between the arrow controls.
- Gave card previews more horizontal room. One-card and three-card layouts now
  share unobstructed artwork, numbering above, and position labels below.
- Aligned multi-card connector lines with their actual preview coordinates.
- Refined the editorial type, card shadows, and lavender action button without
  changing the selected background, arc, wash, cut, or reading behavior.
- All nine spreads pass unclipped-content and containment checks on SE and Pro
  Max. The navigation remains below the artwork with 44-pixel touch targets.
- Six focused WebKit checks passed in one run: all spreads, accessibility, swipe,
  cancellation, no hover movement, refresh, Back, and setup continuation on both
  phone sizes. Frontend typecheck and production build passed. The existing
  main-bundle size warning remains.
- The same six checks also passed together against the production build.
- A separate hardware-frame check passed: Personal Spread renders inside the
  Pro Max frame, survives switching to SE, and keeps the action reachable.
  Both framed screenshots were captured after the launch animation finished.
- Live desktop preview inspection was unavailable because the Mac was locked;
  automated phone screenshots were inspected instead. The development route
  remains available at `http://127.0.0.1:5175/app/tarot`.

## Earlier Evidence

### September 8: Artwork And Controls Polish

- Enlarged one/three-card previews and matched their 2:3 artwork proportions,
  avoiding the previous side cropping. Added a regression assertion for that ratio.
- Simplified carousel arrows to unframed icons, retaining 44-pixel touch targets
  and pressed feedback without cursor-hover movement.
- Balanced the heading, question, position labels, and serif explanation;
  aligned the CTA arrow to the trailing edge and softened card/button shadows.
- Kept the existing room backgrounds, spread geometry, arc, wash, cut, and
  persisted readings unchanged.
- Frontend typecheck, production build, and whitespace validation passed.
- Development checks: six passed, one intentional duplicate-frame skip, one
  Pro Max reload timeout. Its trace has a 255-second gap in frame activity;
  this is recorded as a failed attempt, not a clean development suite.
- All six focused production checks then passed together in 27.1 seconds,
  including all nine spread layouts, accessibility, swipe/cancel/no-hover,
  refresh, Back, and setup continuation on SE and Pro Max.
- Inspected selectable hardware-frame screenshots for Pro Max and SE. Evidence:
  `/tmp/hint-spread-polish-20260908/` and
  `/tmp/hint-spread-polish-production-20260908/`.
- The development route returned HTTP 200. Live desktop interaction remained
  unavailable because the Mac was locked. Native iPhone certification is outside
  this presentation-only pass.

- Frontend typecheck passed.
- Tarot unit/component/adapter suite: the initial focused pass had 96 tests; the
  latest persistence and request-lifecycle pass has 126 passing tests in 15 files.
- Focused WebKit phone suite: 7 passed, 1 intentional duplicate preview-shell skip.
- Subsequent full WebKit matrix: 97 passed, 5 intentional device-specific skips
  across 102 checks in 7.8 minutes, including this layout and storage recovery.
- All nine spreads were checked on SE 375 x 667 and Pro Max 440 x 956, with their
  preview safe-area values applied. The checks cover unclamped copy, normal-flow
  spacing, one mounted spread preview, action reachability, and no runtime errors.
- Hover, cancelled drag, completed swipe, refresh restoration, Back, and setup
  continuation checks passed.
- Production web build passed. The existing large main-bundle warning remains.
- Local API health returned `{"status":"ok"}`.
- The visible app was inspected at both phone sizes and left on Personal Spread
  in the selectable iPhone 17 Pro Max frame at `http://127.0.0.1:5175/app/tarot`.

Screenshots from the focused matrix are in `artifacts/hint/test-results/` under
the `spread-recommen-...-explanation-in-normal-flow` directories for each phone.
These are generated test outputs and may be replaced by subsequent runs.

## Limits And Follow-Up

The first cold development test run hit a duplicate-React hook error; subsequent
fresh test-server runs passed. Do not treat those later passes as proof that the
cold dependency-cache issue is permanently fixed.

The complete browser release matrix now passes, including save-failure and
corrupt-record recovery. Native iPhone gates remain pending, and native bundles
need resync after configuring the actual download URL. See
`tarot-release-evidence-2026-09-04.md` for current release evidence and limits.
No deployment, publication, commit, or push was performed.
