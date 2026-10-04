# Room transitions and fresh visits

Scope: the room/card transition and restart-on-departure request, followed by an additional phone review. This is a local web candidate, not a deployment or native release approval. All browser data and API responses used for verification are fictional and isolated.

## Intended behavior

| Action | Result |
| --- | --- |
| Enter a room from a tile or supported navigation control | The actual destination remains fully visible while a small, source-directed depth movement settles over 1.2–1.3 seconds. Tarot and Ask use 1.3 seconds. No opaque cover, emblem, blur, mask or content fade. |
| Begin typing, tapping, dragging or scrolling during arrival | Settle the decorative movement immediately; deliver the input normally. Navigation and body-portaled dialogs remain outside the transformed content host. |
| Enter a room whose module is still loading | Keep its genuine loading feedback; begin arrival only when the actual room appears. Abandoned, failed or long-expired loads cannot replay an old entrance. |
| Change recommended spread | A continuous 290 ms horizontal track supports arrows, swipe, rapid reversal and keyboard navigation; controls remain in place. |
| Leave Tarot with progress | A readable dialog explains the reset and the records retained. Stay/Escape keeps the exact current visit and restores focus; Leave opens the chosen destination. |
| Re-enter Tarot after leaving | Begin with an empty question. Saved History links remain an explicit way to reopen an existing reading. |
| Leave Ask, Journal or Personalities | A new visit opens at its starting screen. A retained draft or quiz can be restored deliberately; saved records are preserved. |
| Re-enter Animal Tarot | Replay the reveal using the same locked daily card. Its face remains hidden until reveal. |
| Refresh or resume from background within a visit | Retain the current visit, including question, selected cards or the active draft. |
| Use browser Back to leave | Allow normal history navigation, then show a persistent explanation. Do not insert a trapping history entry. |
| App or system reduced motion | Skip decorative travel; settle the state without ceremonial waiting. |

Visit markers are scoped to the current browser tab and local identity. Closing a visit does not delete another tab's durable draft. If session storage is unavailable, the current document keeps an in-memory marker; persistence of that marker across a full reload is not guaranteed in this exceptional storage mode.

## Confirmed fixes from review

| Finding | Reproduction/evidence | Fix |
| --- | --- | --- |
| A cancelled exit did not restore Home focus in mobile WebKit | Pointer activation left `document.activeElement` on body; WebKit then ran the capture microtask before React's delegated navigation. Both phone sizes failed the original focus assertion. | Keep the actual activated link/button through the current task, cancel the cleanup timer on disposal, and use current focus for later programmatic navigation. |
| The departure notice showed cards through its background | In-app preview computed an `rgba(255,255,255,0.56)` panel background. | Give the dialog an opaque pearl surface and a dedicated dark surface. |
| Late Journal save could clear a newer identical draft | The older and newer draft had identical text but represented different edits. | Store and compare a revision identifier in addition to text before clearing a successful submission. |
| Completed quiz data could be overwritten by new answers | Start a fresh quiz after leaving a completed result. | Archive the completed result under its owner before replacing active progress; preserve the original if storage fails. Include archives in scoped History clearing. |
| “next chapter” was interpreted as an ex-partner question | Offline spread and question-title classifiers matched the substring `ex` in `next`. | Require word boundaries for `ex` in both classifiers; retain a regression for the actual question. |
| Unrevealed Animal card showed a mirrored front | The SE/Pro Max WebKit screenshot showed front artwork and reversed title beneath the back emblem. | Explicitly hide the front visually and from accessibility until reveal; keep the existing flip and card identity. |
| Ask's fresh entrance opened partway down the content | SE had `scrollTop=213`, clipping the heading above the thread boundary despite a blank question. | Empty/idle threads start at the top; active conversations retain bottom scrolling. Remove unconditional smooth scrolling so reduced motion applies. |
| Room arrival resembled a camera being covered | The former opaque expanding layer hid the destination. Extending its duration prolonged the obstruction. | Remove the layer and animate the persistent real-content host instead, keeping opacity at 1. Use bounded translation/scale so the canvas edge does not open a gap. |
| Ask still appeared washed out after removing the room cover | The heading's ancestor opacity was 0 at arrival, 0.219 at 251 ms and 0.523 at 650 ms because its own hero faded in over 1.8 seconds. Both phone regressions fail on that version. | Make the empty hero immediately visible; let the single shared arrival own entrance motion. Existing thinking and message feedback remain intact. |

The new notice and manual-restore text are available in the existing five app languages. Saved readings, birth details, preferences and daily card locks remain intact. This pass adds no formal account or cross-device sync behavior.

## Verification record

Verification is separated by product revision. The latest isolated preview is `http://127.0.0.1:5234/app?hintPreview=frame`. For a new browser origin, open `http://127.0.0.1:5234/design-preview.html` and choose Home: this temporary preview launcher creates the fictional Amelia Rose profile only when no local identity exists, then opens the selectable phone frame. The launcher is outside product source and is not a release asset. The preview uses a clean production build with its API proxy pointed at an unavailable local port; automated journeys intercept every API request with isolated fictional fixtures. This is not a connected production beta.

| Revision / scope | Result | Evidence |
| --- | --- | --- |
| Fresh-visit baseline, port 5232: full frontend | 661 tests across 78 files; typecheck and build passed | Baseline source manifest in `evidence/fresh-visits-2026-09-10/source-manifest.json` |
| Baseline room entrances / fresh visits / phone reflow | 70 passed, 2 device-scoped skips, no flakes | `/tmp/hint-room-visits-20260911/verified-5232.json` |
| Baseline Ask / Journal / Personalities / Animal | 22 passed | `/tmp/hint-room-visits-20260910/other-rooms/final-5232/results.json` |
| Baseline Tarot functional suite | 157 unique passing cases, 15 intentional device-scoped skips | `/tmp/hint-tarot-5232-20260911/{e2e.json,se/e2e.json,save-retry/e2e.json}` |
| New content-arrival host, port 5233 | 78 passed, 2 device-scoped skips, no failures or flakes | `/tmp/hint-room-visits-20260911/verified-5233.json` |
| Final Ask opacity correction, port 5234: full frontend | 672 tests across 78 files; typecheck and clean production build passed | `/tmp/hint-content-arrival-final-{unit,types,build}.log` |
| Final targeted WebKit phone matrix, port 5234 | 18 passed, no failures or flakes | `/tmp/hint-room-visits-20260911/verified-5234.json` |
| Final isolated browser RAF sample, port 5234 | 2 cases passed; twelve 1550 ms warm-arrival intervals | `evidence/fresh-visits-2026-09-10/host-raf-5234-metrics.json` |

The 5232 Tarot total includes a focused two-phone rerun of the storage-full recovery case: the original test expected a native confirmation, while the implemented flow correctly uses the new shared exit dialog. The corrected case reads the dialog, chooses Stay, confirms the unsaved reading remains usable, confirms History is empty, and retries persistence successfully. The original failure logs remain available; they are not described as clean initial passes.

Baseline coverage includes all nine spreads through the full Pro Max ritual, all nine selection geometries on both phone sizes, wash/cut/pick/reveal, saved History recovery, follow-up, sharing privacy and repeated rituals. The later motion revision preserves those feature implementations; it receives its own arrival/interaction checks rather than being represented as a full rerun of every baseline case.

The new host checks include visible and usable content during arrival, source-relative bounds, repeated room navigation, fixed navigation chrome, pointer input within the first 300 ms, late module arrival, back/refresh, departure focus, and changing reduced motion during animation. In the 5233 run, scripted pointer interaction obtained focus 114 ms after animation start on Pro Max and 154 ms on SE. This measures when the room was engaged during arrival, not the delay from pointerdown to focus and not physical-device touch latency.

The final 18-case run adds the reproduced Ask heading/ancestor-opacity regression on both phone sizes, early editable input, a delayed module receiving its full arrival duration, rapid room changes with fixed navigation, all four App/system reduced-motion combinations, and enabling reduced motion mid-arrival.

The final source manifest covers 316 frontend product/configuration files, excluding tests. Its digest is `db14065591dfd564343b19d6e7553a42c63a4584080d7fe0b78ab91e8e9bdb56`; the manifest records the hashing algorithm and every file hash. The only product change after the 5233 host verification is removal of Ask's independent hero opacity animation.

All final checks above completed with the product source unchanged from the recorded final manifest. Intermediate runs on ports 5229–5231 were used for reproduction and discovery; their partial passes are not final full-suite evidence.

### Browser frame observations

The RAF run began only after all other test/capture browsers and build workers had finished. It sampled three warm Tarot and three warm Astrology entrances per viewport, each over 1550 ms.

| WebKit viewport | Highest per-interval p95 frame gap | Largest individual gap | Gaps at least 100 ms |
| --- | --- | --- | --- |
| Pro Max 440×956 | 27 ms | 84 ms | 0 |
| SE 375×667 | 28 ms | 95 ms | 0 |

Every observed interval had p95 at most 33 ms, but the larger isolated gaps remain material. This sample measures browser-host RAF timing on this Mac, not compositor presentation, physical-iPhone performance, input response latency or native release readiness. Raw numeric observations are retained rather than converted into an unsupported “60 fps” claim.

## Visual evidence

The review uses a selectable Pro Max 440×956 frame and SE 375×667. The departure dialog also has Spanish 200% text checks in both themes, with top and bottom screenshots showing that the complete notice and actions remain reachable.

| Evidence | Scope |
| --- | --- |
| [Tarot arrival video](evidence/fresh-visits-2026-09-10/tarot-content-arrival.webm) / [mid-arrival frame](evidence/fresh-visits-2026-09-10/tarot-content-arrival-mid.png) | Port 5233; Tarot and shared arrival source are unchanged in the final revision. Actual content is visible at every sampled point. |
| [Final Ask arrival video](evidence/fresh-visits-2026-09-10/ask-content-arrival.webm) / [mid-arrival frame](evidence/fresh-visits-2026-09-10/ask-content-arrival-mid.png) | Port 5234, Pro Max. The heading and every ancestor remain opacity 1 at 0/250/650/1400 ms; the field is hittable at 250 ms. |
| [Final Ask SE frame](evidence/fresh-visits-2026-09-10/ask-content-arrival-se.png) | Complete heading visible at the top of the scrollable thread. Longer content continues below the viewport; the composer remains reachable. |
| [Departure dialog, SE](evidence/fresh-visits-2026-09-10/exit-se.png) / [Pro Max](evidence/fresh-visits-2026-09-10/exit-pro-max.png) | Readable explanation, Stay/Leave choices and preserved records. |
| [Browser Back notice](evidence/fresh-visits-2026-09-10/browser-back-notice.png) | Persistent explanation after normal history navigation. |

Final independent capture covered Ask normal motion, early typing, reduced motion and SE. Early typing was retained and immediately ended the arrival; reduced motion created zero arrival animations. No additional visual defect was found in this scope.

The previous `home-tarot-spread-motion.webm` and `tarot-entrance-mid.png` show the superseded opaque 5232 entrance. They are retained only as before-change evidence; do not use them to demonstrate the final room arrival. The spread movement shown there is unchanged.

The supplied [Galaxy reference](https://x.ai/galaxy) was inspected for visual restraint and depth. No claim is made that Hint copies or matches its measured animation timings.

## Remaining limits

Pixel-golden assertions are not updated to conceal changed visuals. Functional voice-input tests remain selected separately from their old screenshot baseline. Native keyboard/IME, sharing cancellation, haptics, iOS lifecycle and physical-device frame timing remain unverified here.

The build still reports an existing large-chunk advisory. Browser RAF sampling is useful for finding local stalls but does not satisfy the physical-iPhone performance gate. Production URLs, Apple signing/team configuration and native-device evidence remain separate release requirements. No deployment, upload, real-data mutation or paid-provider run was performed.
