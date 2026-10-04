# Tarot reading depth and motion verification

September 8, 2026. This continues the free deeper-reading demo and the prior
Tarot release audit. No deployment, publication, credit purchase/deduction, or
unrelated feature redesign was performed.

## Changes

- Shared Tarot stage entrances settle over 280 ms, with a shorter 120 ms exit.
  Reduced motion removes translation and completes promptly. Card identities,
  numbering, arc geometry, order, and room design are unchanged.
- Card detail pinch updates a motion value directly rather than easing toward
  every touch sample through React state. Tap zoom still settles smoothly;
  changing cards resets zoom and stops the previous animation. Cancellation
  suppresses a phantom zoom tap.
- Deeper content opens/closes through a reversible 380 ms disclosure transition,
  with a short fade. Closed content is inert. System and Hint reduced-motion
  preferences remove movement and use a 1 ms transition. Reading arrival,
  pending-to-ready content, and receipt motion use short, controlled transitions.
- Newly generated brief answers have an explicit direct-answer field followed
  by a supporting sentence. This is assembled into the existing summary contract
  during the initial request. Existing saved answers are retained.
- The structured reader has a dedicated plain-language prompt; the narrative
  reader and spread recommender retain their existing prompts.
- New deeper readings require four sections: Why this answer, How the cards
  connect, What to watch for, and Your next step. Card explanations must include
  distinct practical implications and observable signs. A missing synthesis or
  watch-for section is a retryable failure, not a fake successful upgrade.
- An optional 600-character context field is saved with the reading and sent
  only when the user requests detail. Yes / Somewhat / Not yet feedback asks
  whether the interpretation helped them understand something new. Feedback is
  local to that reading; no analytics collection or credit accounting was added.
- Saved context, detail, and feedback restore through refresh/History. Older
  detail without the new optional sections remains readable. Malformed optional
  metadata does not destroy the original answer or selected cards. Receipts
  continue using the original answer and never include chat, added context, or
  feedback.

## Verification of this change

- Frontend logic/component/adapter tests: 270 passed, 19 files.
- API/provider tests: 22 passed, including exact cards, required deep sections,
  optional-context forwarding/length bounds, cancellation, and explicit failure.
- Workspace typechecks and production frontend/API builds passed. API checks
  were rerun after the final prompt/validation changes. Scoped diff checks passed.
- Production WebKit on Pro Max 440 × 956 and SE 375 × 667: 60 passed and two
  intentional skips across two focused runs (62 cases total).
  - Reading/motion run: 27 passed, one duplicate keyboard-case skip, 2.1 minutes.
  - Ritual/layout run: 33 passed, one duplicate frame-pacing-case skip, 1.8 minutes.
- Coverage includes full journeys and restore, added context/feedback durability,
  original-answer/receipt privacy, retry, accessibility and touch targets,
  keyboard containment, pinch handlers and reset, rapid animation reversal,
  normal and both reduced-motion preferences, interrupted wash/cut recovery,
  all nine spreads, all three arc themes, existing 1/3/5/7/9-card reading visual
  baselines, and the existing Auto Wash frame-pacing gate.
- Browser pinch tests dispatch TouchList-shaped events because WebKit does not
  permit constructing Touch. They verify touch-handler behavior and immediate
  scaling, not native gesture recognition on physical hardware.
- The only updated visual baseline is the Pro Max one-card reading, where the
  optional context field is now visible. The actual and diff were inspected
  before updating; the final comparison run passed without baseline updates.
- Mocked phone screenshots were inspected and retained in
  `evidence/reading-depth-2026-09-08/pro-max.png` and `se.png`. These demonstrate
  layout and feedback controls, not provider prose quality.

## Content quality and release limits

Live brief/deeper provider smoke requests were run with a neutral skill-learning
question and a fifteen-minute practice constraint. Both modes returned HTTP 200
and API provenance (final sample: 3.1 s brief / 5.0 s detailed). The final brief
opened with consistent daily practice; the deeper next step named one specific
exercise and a progress check. Surrounding prose still included generic growth
language. The neutral sample is retained as
`evidence/reading-depth-2026-09-08/live-provider.json`.
Testing exposed persistent generic phrasing despite style-only
prompt changes, leading to the dedicated direct-answer field and explicit
reasoning sections. Structural correctness is verified; consistently specific,
non-repetitive language is still a demo evaluation gate. A longer interpretation
is not automatically more useful. Review the saved demo feedback before adding
credits; local feedback is not aggregated into a product-wide metric.

These checks are desktop-hosted mobile WebKit evidence, not physical-iPhone
smoothness certification. The prior native gates still apply: full Xcode/iOS SDK,
current Capacitor bundle sync/build, device speech/haptics/share/lifecycle tests,
and the real configurable download-page URL. Nothing was deployed or submitted.

The web preview remains on port 5175 and the rebuilt API on 5050. Production
tests used temporary port 5193 because the standard test port was occupied. The
temporary config was removed after verification. Raw browser results remain in
`/tmp/hint-tarot-motion-and-depth` and `/tmp/hint-tarot-stage-motion`.

Reproduce with the existing production Playwright config and the filters:

```
card detail stays|deeper demo|deeper reading motion|reading layout|completes and restores|keyboard-sized|Tarot reading has accessible
spread .* remains contained|reduced motion completes|Auto Wash avoids|pick arc stays ordered|backgrounded cut|interrupted automatic ritual
```
