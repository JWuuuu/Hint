# Wash and shuffle refinement — 2026-09-12

Preview: http://127.0.0.1:5237/app/tarot?hintPreview=frame

The previous 5235/5236 previews remain unchanged. This candidate preserves the lighter 1.45 manual contact strength, clockwise guidance, hidden 78-card order and the existing wash/cut card geometry.

## Changes and evidence

| Area | Before | This candidate |
| --- | --- | --- |
| Hand wash | Forces mostly turned cards around the table centre; inward sweeps had little effect. | Nearby cards follow the hand's radial movement as well as its clockwise sweep. The controlled gentle inward stroke reduced a card's distance from centre from 23 to 19.42 table units, compared with 22.87 previously. Friction and speed limits remain unchanged. |
| Post-cut shuffle | Three whole packets moved out and back in 883 ms in the baseline regression. Individual interleaving was absent. | Two packets open, then face-down cards alternate into the centre over 1.9 seconds and square in place. No whole-deck fade or enlargement. Both phone runs observed 12 ordered visual arrivals and a 116 px packet separation. |

The new shuffle regression fails against the unchanged 5236 build and passes against this candidate. Physics evidence is in `physics-comparison.json`; the new inward-stroke unit test covers the hand-following behavior. Only `washPhysics.ts` and `TarotRoomFlow.tsx` changed in the product source relative to the lighter-wash candidate. `source.json` records the exact 316-file candidate fingerprint.

## Verification

- 56 unit/component tests across seven files passed, including hidden identities, touch ownership, resting cards, background cleanup, and reading persistence.
- Frontend TypeScript and the isolated production build passed. The pre-existing large-chunk build advisory remains.
- 26 production WebKit cases passed across SE 375×667 and Pro Max 440×956, with no skips or retries. These cover manual/automatic flows, repeated Auto Wash clicks, cancellation, background recovery, lost/delayed transition events, unchanged wash/cut geometry, and normal/App-only/system-only/both reduced-motion settings.
- Actual framed journeys and screenshots reviewed on Pro Max with the bright setting and SE with the dark setting. Headers, cards and actions remained visible; each reached Pick Cards without runtime errors. Room surfaces retain their existing palette.
- Four sequential desktop WebKit measurements, without screenshots/video during sampling: RAF frame-gap p95 18–19 ms; no measured gaps ≥100 ms; pointer-to-style-mutation p95 14 ms. This is browser emulation evidence, not physical iPhone performance or end-to-end touch latency.

`Wash-and-Shuffle.mp4` is an actual Pro Max phone-frame recording at normal playback speed (25 fps capture). Only the recording's outer blank padding and opening setup were trimmed; the final frame is held briefly. It is a visual demo, not a frame-rate benchmark.

All tests used isolated browser storage, fictional data and intercepted API requests. No deployment, existing-service restart, paid API request or real-account modification was performed. Physical iPhone feel, native lifecycle and haptics remain unverified.
