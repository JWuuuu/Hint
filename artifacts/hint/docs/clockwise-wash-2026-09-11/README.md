# Clockwise wash and continuous cut — 2026-09-11

The routed Tarot ritual now uses one clockwise instruction and a hand-driven wash. Cards near the hand take more pressure, carry a little momentum, and settle when the hand stops. Auto Wash takes 3.6 seconds instead of 2.2 seconds. The gather and cut share their table, card back, card dimensions and central origin, so the cut no longer starts with a larger, translucent deck on a different screen.

Only six product files changed from the previous candidate; `source.json` identifies them and hashes all 316 frontend source/config files. Existing unrelated work remains intact. The candidate is an isolated local preview at `http://127.0.0.1:5235/app/tarot?hintPreview=frame`; its API proxy deliberately points at an unavailable local endpoint. Automated contexts intercept all API requests and use fictional data. No production data, paid service, deployment, or native upload was used.

## Fixes and evidence

| Issue | Before | Implemented behavior and evidence |
|---|---|---|
| Direction changes during a gesture | A small reverse motion changes the instruction to counterclockwise | Touch, keyboard and auto remain clockwise. The direction regression failed before the change. |
| Whole-table movement after the hand stops | Holding still for 550 ms moved cards an average of 33.9 px in the recorded Pro Max reproduction | Local contact plus friction. A held hand reaches rest; unit and phone regressions check movement after settling. |
| Cards lose their individual angles | After repeated auto steps, only two distinct angles remained at the old clamps | Individual angles remain distinct; all hidden identities and orientations are preserved. |
| Second finger takes ownership | A second pointer could move and complete the active wash | Pointer ownership guards; second-pointer regression failed before the change. Cancellation remains separate from release. |
| Wash-to-cut visual jump | Last gathered card was about 56.5×83.6 px; the first cut card was about 97.2×147.5 px, elsewhere on screen, during a whole-screen fade | Shared geometry and opaque card backs. The browser regression compares the last gathered and first cut card's x/y/width/height and inherited opacity. |
| Premature or lost settle events | A stale gather event could complete a later phase | Phase/time guards plus recovery deadlines anchored to actual squaring start. Dropped-event and delayed-timer regressions cover recovery. |
| Long wash unwinds whole rotations | A long-rotated card could turn more than 700° while gathering | Gather and square choose the nearest equivalent face angle. The regression failed before this correction. |
| SE header overlap | Spanish deck-count badge met the fixed room badge | Short viewports reserve extra top space. Five-language frame review checks at least 8 px clearance; actual inspected frames have more than 34 px. |

`red.log` and `long-wash-red.log` record the intended pre-fix failures. Changes remain in the existing authoritative `TarotRoomFlow`; full hidden 78-card order, selection, reveal, saved readings and follow-ups stay separate from the visual card proxies.

## Verification scope

| Coverage | Evidence |
|---|---|
| Full frontend unit/component suite | 678 tests pass across 80 files; `unit-final-cwd.log` |
| TypeScript and production build | Pass; `typecheck-final.log`, `build-final.log`, `build-assets.json`. Existing large-chunk build advisory remains. |
| Phone production regressions | SE 375×667 and Pro Max 440×956: manual/auto, repeated clicks, cancelled/tap gestures, background/refresh recovery, gather/cut continuity, dropped events, delayed timers, held-hand rest, saved full journey, private receipt export, nine restored spread layouts. Five consecutive rituals and the suite performance gate run on Pro Max; their duplicate SE entries are intentionally skipped. Final evidence covers 56 distinct cases, plus six repeated reduced-motion checks; see the note below. |
| Languages and motion | `visual-matrix/results.json`: English/bright/normal/Pro Max; Spanish/dark/normal/SE; Chinese/bright/App-reduced/SE; Japanese/dark/system-reduced/Pro Max; Korean/bright/both-reduced/Pro Max. Every case proceeds through cut to pick. |
| Visual inspection | Actual hardware-frame PNGs inspected for all five languages, both viewport sizes, wash/cut spacing, readable instructions and bottom controls. Reduced-motion cut states are observed via DOM changes because they intentionally pass too quickly for dependable screenshot polling. |
| Performance | `performance.json` describes sequential desktop WebKit sampling without video/screenshot overhead. Final manual frame-gap p95: 18–19 ms; gather/cut p95: 18 ms; observed pointer-to-style-mutation p95: 13–14 ms; zero gaps ≥100 ms in these samples. Baseline p95 was also 18 ms, so the evidence supports removal of the visual discontinuity, not a claimed native FPS improvement. These browser figures are not physical-iPhone evidence. |
| Video | `Wash-Deck-Preview.mp4`, actual framed interaction with fictional inputs, H.264, 640×1100, 25 fps, silent. Video capture is visual evidence, not a frame-rate benchmark. |

## Test-harness correction

The main production run recorded **55 passed, 2 intentional skips, 1 polling failure**. The failed assertion looked for the short-lived reduced-motion “Cutting the deck” heading after the app had already reached Pick Cards. Its failure screenshot and trace show the successful destination. The assertion now records the cut transition through a DOM observer, retains the original <1.2 s cut deadline, and requires the stable Pick Cards destination within 3 s. That corrected case passed **three consecutive runs on each phone** (`reduced-motion-recheck.log`). No application change or snapshot update was made to accommodate that test. All other cases passed against the same production candidate.

This is a focused wash/cut improvement, not an app-wide release certification. Physical iPhone rendering, native haptics and lifecycle behavior remain unverified. The wider TestFlight gates from the release plan remain separate.
