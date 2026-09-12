# Brief and deeper Tarot readings — demo verification

September 8, 2026. The user approved free deeper readings during the demo, with
credit deduction deferred. No payment, entitlement, purchase flow, deployment,
or store submission was added.

## Behavior

- Newly generated initial readings request a complete answer in one or two short
  sentences, one concise sentence per card, and one next step. Stored original
  readings are retained intact; existing long answers are not destructively cut.
- An explicit “Explore deeper · Free demo” button requests more interpretation
  for the same question, positions, identities and orientations. It does not
  redraw cards or replace the original answer. English and Chinese copy explain
  that the demo does not consume credits.
- Deeper results explain the cards, their practical implications for the question,
  and observable signs or limitations. The generation contract requires the
  latter two fields rather than accepting a merely longer basic interpretation.
  More detail is not represented as greater predictive certainty.
- Detail is stored separately on the same local reading, restores through History
  and refresh, and can be opened/closed without another request. Subsequent chat
  uses that detail as context, while durable conversation content is retained.
- Duplicate taps coalesce. A bounded request cancels on departure. Invalid card
  mappings, unavailable providers and local fallback responses do not unlock a
  fake detailed reading. Failures show explicit retry and preserve the original.
- Existing save-failure warnings/retry also cover detailed results. Damaged saved
  detail is ignored without damaging the basic reading or chosen cards.
- Receipts continue using the original reading and existing privacy rules; they
  do not silently acquire deeper text or chat.

## Verification

- Frontend Tarot logic/component/adapter suite: 270 passed in 19 files.
- Tarot API/provider suite: 20 passed in 2 files.
- Workspace typechecks and production web/API builds passed. Final API typecheck
  passed after the provider-validation refinement. Whitespace checks passed.
- Focused production WebKit matrix on Pro Max 440 × 956 and SE 375 × 667:
  19 passed, one intentional duplicate keyboard-test skip, in 1.5 minutes.
  This includes both full journeys, reading accessibility/touch targets,
  detailed reading/retry/restoration/privacy, keyboard containment and all
  existing 1/3/5/7/9-card reading visual baselines.
- Four deeper-reading checks passed again after fixing screenshot capture to wait
  for the launch overlay and dismiss the card tip. Final Pro Max and SE detail
  screenshots were visually inspected.
- One expected visual baseline changed: the Pro Max single-card reading now shows
  the deeper-demo CTA where the previous “Want more?” invitation appeared. Its
  first comparison failed, the actual/diff images were inspected, and only that
  baseline was updated. The next 20-check run passed as reported above.
- A real provider smoke test for a neutral skill-learning question returned HTTP
  200 and `source: api` for both brief and detailed modes. The brief response had
  two answer sentences and one card sentence. The final deeper response added a
  bounded practice example and an observation exercise to the card interpretation.
  This is one live content sample, not broad model-quality certification.
- Live testing exposed an overly restrictive per-fragment length check. Provider
  fragments now have generous individual bounds and a combined 1,200-character
  ceiling per detailed card; concise prompt targets remain lower. An earlier
  overlong fragment correctly surfaced as retryable 503 rather than fake success.

## Local preview and evidence

The local API was rebuilt/restarted on port 5050; its health check passes. The
existing web preview remains at `http://127.0.0.1:5175/app/tarot` (HTTP 200).
Production checks used an isolated temporary config on port 5193 because the
standard production test port was already occupied. That config was removed.
Screenshots from the final focused checks are in `/tmp/hint-tarot-detail-demo/`.

Re-run the frontend and API `test:tarot` scripts, workspace `typecheck`, and the
production phone suite filtered by:

`deeper demo|reading layout|Tarot reading has accessible|completes and restores|keyboard-sized`

The prior full Tarot audit is recorded in `tarot-verification-2026-09-08.md` and
predates this feature. Native Xcode/device verification, current Capacitor sync,
and the real download-page configuration remain separate release gates. This
feature does not implement future credit pricing or server-side paid access.
