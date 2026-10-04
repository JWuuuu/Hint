# Hint non-Tarot app improvement goal

## Goal and boundaries

Audit the whole non-Tarot mobile product, improve the highest-priority complete flows, and leave an honest release checklist. Preserve existing work. Do not change Tarot or Animal Tarot implementation, card identity, or ritual behavior. Browser tests are evidence for those environments, not proof that every device has no bugs.

## Plan

1. Inventory Home, Daily, Astrology, Collection, Personalities, Ask, History/detail, Profile/settings, Rooms, Journal, Dream, login/onboarding, and About/support/legal navigation. Distinguish working features, previews, missing states, and release blockers.
2. Inspect at 375×667 and 440×956. Check long text, scrolling, fixed-navigation overlap, touch targets, form labels, light/dark themes, failed requests, empty content, and refresh/back behavior.
3. Repair Astrology first: make zodiac learning, natal chart, and dated transits distinct but connected; make source/availability honest; remove implementation diagnostics from the main journey; handle missing birth time; prevent old requests from overwriting a newer profile/date; show only actual transit dates.
4. Fix reproducible app-wide navigation/layout defects in their owning modules. Avoid a broad visual rewrite without evidence.
5. Run targeted tests and frontend checks, manually inspect phone frames, and update this document with completed work and remaining priorities.

## Initial source findings

| Priority | Area | Evidence / consequence | Planned action |
| --- | --- | --- | --- |
| P1 | Astrology data | `buildMockNatalChart` derives non-Sun positions from a hash. Chart/sign views can display it from a profile without a saved calculation. | Keep personal results separate from illustrative data; require calculated data for personal placement claims. |
| P1 | Transits | Empty/error responses are replaced with sample transits; `buildTransitWindow` supplies dates that were not returned by a calculation. Requests have no current-date/profile guard. | Honest empty/error states, real returned dates, ignore stale requests. |
| P1 | Astrology comprehension | Six dense sections named Chart, Code, Today, Birth, Together, Reports; navigation hidden before profile creation; provider configuration dominates the main screen. | Three primary concepts, secondary setup/tools, simple explanations and accessible navigation. |
| P2 | App routes | Unknown `/app/*` paths display a dash. | Provide a useful recovery screen. |
| P2 | Rooms | Search is a static “soon” placeholder; fixed desktop-style top spacing; many unavailable modules. | Review actual phone layout and make discovery reflect working features. |
| P2 | Dream | A pretend capture field and decode control accompany sample history. | Clearly label preview content and give a working next action. |
| P2 | Settings | Clear history currently clears all local storage and ignores deletion failures. | Record as a separate data-management concern; avoid changes that affect Tarot in this goal. |
| P2 | Journal | Previous pass implemented draft recovery, explicit errors, input limits, and accessible phone controls. | Include in regression coverage. |

Status: first audit and improvement pass completed on 2026-09-09 UTC. Remaining release work is listed below.

## Completed in this pass

- Replaced the dense Astrology landing flow with three primary concepts: zodiac signs, natal birth chart, and current transits. Birth details, Together, and report previews remain secondary tools. Existing tab links remain compatible, and Back/refresh retain the selected section.
- Added a twelve-sign learning view that works without an account and does not initiate a personal calculation. Explained how signs, planets, houses, and aspects fit together, with deeper explanations behind disclosure controls.
- Rebuilt the natal presentation around returned placements. Corrected SVG circle fills to use color tokens rather than CSS gradients (which rendered black in WebKit). The wheel uses actual zodiac degrees and returned house cusps; labels sit in separated columns. Missing planets, aspects, houses, and orbs stay missing. The old personalized mock display and synthesized provider-chart fields were removed.
- Removed sample transit fallback rows, fabricated transit dates, and unsupported arbitrary-date navigation. Failed calculations show retry states, and an empty successful calculation stays empty. Failed responses are not cached as successful results.
- Guarded late chart/transit responses after profile changes. Existing successful chart data remains visible after a failed refresh. Changed the local chart-cache version so older mixed mock/provider records are not reused.
- Improved birth input validation and location lookup: editing a city clears old coordinates/timezone; editing the date invalidates the offset; late search matches are ignored. Unknown birth time does not silently become noon or an invented Ascendant. Removed sample autofill.
- Made Rooms search and filters work, removed duplicated room lists, reduced top spacing, and made preview visibility explicit. Dream now labels its sample content and links to the working Journal.
- Replaced unknown app routes with a recovery page. Fixed About/legal navigation with preview query strings. Improved Daily date labels and removed clipping from the Home theme summary.
- Corrected About's account-readiness claim. Astrology shortcuts in History are now identified as shortcuts and excluded from saved-reading totals; their transit/report descriptions match the current implementation. Tarot reading behavior and records were not changed.
- Retained and regression-tested the earlier Journal draft, retry, and save-recovery improvements.

## Verification and evidence

The route inventory covers `/app`, Daily, Astrology, Collection, Personalities, Ask, History, a missing reading, Profile, Rooms, Journal, Dream, Compatibility, Login, an unknown app path, About, Privacy, Terms, Disclaimer, and Contact.

- **34 phone-browser tests passed** in the final combined run (about 1.4 minutes). All 20 audited routes passed runtime-error and page-level horizontal-overflow checks on both phone sizes.
- WebKit phone sizes: **375×667** and **440×956**. Route inventory checks runtime exceptions and page-level horizontal overflow; it also records clipped-text candidates and small controls for review.
- Astrology and Journal flows include failed requests, retries, empty results, stale responses, refresh/back, reduced motion, and accessibility checks. The new chart test includes eleven clustered placements and an aspect with no returned orb. A Chinese sign-learning smoke check covers layout and prevents unwanted calculations.
- Both bright/dark preference settings were checked for Astrology and Journal. Astrology deliberately uses the app's cream route palette in either preference; this is not evidence of a separate dark Astrology design.
- Manually inspected the selectable Pro Max and SE frames, including lower sign details and the chart action above the bottom navigation. Restored the temporary onboarding bypass and preview selection afterward.
- Five backend normalization/retry tests pass. Frontend and API TypeScript checks pass. Frontend and API production builds pass; the frontend still reports a large-bundle warning (~1.28 MB main JavaScript before gzip).
- Browser tests use controlled API fixtures. These results do **not** certify live provider accuracy, real authentication, physical-device keyboard/safe-area behavior, or every translated screen. The running shared API process was not restarted; the rebuilt API bundle requires a normal server restart/deployment to take effect there.

Automated evidence is in `e2e/app-audit.spec.ts`, `e2e/astrology.spec.ts`, and `e2e/journal.spec.ts`; retained screenshots and route metrics are under `docs/app-audit-2026-09-09/`. A scrolled content boundary is not automatically a clipping bug: content must remain reachable above fixed navigation at the end of the scroll.

## Remaining priorities

| Priority | Area | Next complete slice / acceptance condition |
| --- | --- | --- |
| P1 | Account and ownership | Replace the local beta code/sign-in flow with real verification and authenticated account ownership. Verify sign-out, account switching, cross-device recovery, and private API access before claiming production accounts. |
| P1 | Clear history | `SettingsList.clearHistory` ignores deletion failure and clears all local storage. Replace with scoped deletion, explicit failure recovery, and deliberate preservation of preferences/account/drafts. Deferred here because it affects Tarot data. |
| P1 | Together / Compatibility | Audit provider completeness, derived relationship scores, stale results after partner edits, invitation consent, and share-link recovery. This pass removed mock pre-result highlights and rejects fallback results, but does not certify synastry interpretation or complete the invitation flow. |
| P2 | History / Ask | Add explicit remote-history error recovery and decide which Ask conversations persist. Astrology currently has tool shortcuts, not a full saved-calculation archive. Keep record types and actual saved counts honest. |
| P2 | Personalities | Add review/back/edit for quiz answers and explain the role of heuristic scoring. Verify restarting a quiz, saved progress, long results, and share output on a real device. |
| P2 | Translation and visual consistency | New Astrology content supports English and the existing Chinese locale; some secondary/new copy still falls back to English. Audit all five locales and decide whether to add Traditional Chinese. Audit remaining small controls and dense content beyond initial route states. |
| P2 | Performance and native validation | Split heavy route bundles, test slow connections, and verify physical-device keyboard, sharing, speech, haptics, lifecycle, and safe areas. Bundle/build success is not native release approval. |
| P3 | Preview features | Dream and reports remain explicitly labeled previews. Design their real input/output, persistence, and recovery behavior before presenting them as working features. |

## Why the Astrology structure changed

The natal and daily-transit services have different inputs and outputs. The current [daily transit endpoint documentation](https://astrologyapi.com/developers/v1/western/natal_transits/daily) exposes birth inputs and a returned `transit_date`; it does not document an arbitrary target-date input. The UI therefore shows the date returned by the calculation. The [western horoscope endpoint](https://astrologyapi.com/developers/v1/western/western_horoscope) is a separate natal-chart source. Missing returned fields must not be filled using hash-based example placements.

This goal delivers the first prioritized improvement pass and an actionable remainder. It does not claim the entire app is bug-free or ready for public release.
