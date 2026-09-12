# Lighter manual wash — 2026-09-11

Manual contact strength is now 1.45 instead of 1.0. A gentle 4 px hand movement produced about 45% more card travel in the controlled before/after comparison. The existing velocity ceiling and friction still prevent uncontrolled sliding. Auto Wash supplies its own force envelope and remains exactly unchanged in the 216-frame comparison, including its 3.6-second ritual duration.

Only `washPhysics.ts` changed from the previous frontend candidate. See `source.json` for the source fingerprint and `response-comparison.json` for the measured response.

Verification: 25 focused unit/component tests passed; frontend TypeScript and production build passed; 12 production WebKit tests passed across SE 375×667 and Pro Max 440×956. Checks cover manual input, resting cards, clockwise guidance, reduced motion, wash/cut geometry, top clearance, and lost/delayed transition recovery. The framed manual journey also completed without runtime errors; its screenshot is `lighter-wash-phone.png`.

Preview: http://127.0.0.1:5236/app/tarot?hintPreview=frame

All browser contexts used fictional data and intercepted API requests. This is an isolated local preview, with no deployment or paid API calls. Physical iPhone feel remains for hands-on review.
