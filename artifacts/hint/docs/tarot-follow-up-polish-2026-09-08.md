# Tarot follow-up continuity and return navigation

September 8, 2026. Continued the authorized Tarot polish without deployment or
changes to unrelated features, card geometry, room artwork, or native packaging.

## Findings and fixes

The previous follow-up serializer chose either the brief or deeper reading and
cut the resulting text at 8,000 characters. A long spread could lose later card
interpretations and its next step. Optional user detail was not passed directly
to the follow-up request.

The new context builder reserves space for the original answer, deeper reasoning,
connections, warning signs, next step, and the detail used for a completed deeper
reading. It distributes the remaining space across every selected position.
Long text is excerpted only for the API request; saved readings stay complete.
Unused context drafts are not sent. The endpoint's existing 8,000-character
limit remains unchanged, and receipts do not acquire this extra context or chat.

A bottom “Back to short answer” button now closes a deeper reading and returns
focus and scrolling to the original answer. In WebKit, scrolling during the
height transition was cancelled as the scroll range shrank. Scrolling now starts
on disclosure transition completion; opening the panel again cancels a queued
return. Reduced motion uses immediate scrolling. No new network request occurs.

## Verification

- Frontend suite: 277 tests passed across 20 files, including seven new context
  tests covering 1/3/5/7/9/10 cards, unchanged saved data, required sections, and
  exclusion of unused drafts. The focused eight logic/component tests passed
  again after the transition fix.
- Frontend typecheck, production build, and scoped whitespace checks passed.
- Thirty distinct production WebKit cases verified across Pro Max 440 × 956 and
  SE 375 × 667. The wider run passed 28 cases; two stalled-request cases exposed
  outdated selectors. The composer now has a stable test ID because its
  placeholder changes while waiting. The final 12-case rerun passed all cases,
  including both stalled-request cases plus deeper-reading and motion coverage.
- The original normal-motion return-scroll failure was reproduced on both phone
  sizes and fixed before the final run. All three motion modes verify focus,
  answer visibility, closed-panel inertness, and rapid reversal.
- Browser coverage also checks restored added context in the actual chat request,
  original/deep answers and next step in that request, receipt privacy, failure
  retry, offline/stalled follow-ups, departure cancellation, failed-save recovery,
  accessibility/touch targets, and unchanged 1/3/5/7/9-card visual baselines.
- Mocked UI screenshots inspected: `evidence/reading-follow-up-2026-09-08/pro-max.png`
  and `se.png`. No visual baseline updates were needed.

Raw reports are in `/tmp/hint-reading-polish` and
`/tmp/hint-reading-polish-final`. The temporary port-5193 production test config
was removed. These checks do not certify physical-device smoothness or new AI
prose quality. Existing Xcode/Capacitor/device/download-URL release gates remain.
