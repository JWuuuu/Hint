# Reading card zoom tip

The existing pop-out tip now clearly says “Tap a card to look closer” and
“Open any card, then tap or pinch to zoom in on the artwork.” English and Chinese
copy were updated. The small dismissible widget uses larger text, appears after
the reading is ready, and leaves eight seconds to read in both motion modes.

Displaying the tip no longer marks it as learned. Opening a card or dismissing
the tip acknowledges it for that reading in the current session. An unacknowledged
tip can appear after refresh; a different card selection gets a new tip. Opening
a card before the appearance timer fires also suppresses the queued tip. Reduced
motion removes its translation and scaling.

Verification: 270 frontend tests, frontend typecheck, production build, and
18 production WebKit checks passed across Pro Max 440 × 956 and SE 375 × 667.
The browser checks cover normal/reduced reading time, refresh, acknowledgment
through tapping/dismissal, a different reading, existing pinch behavior,
accessibility/touch targets, and unchanged reading visual baselines. An existing
component assertion was updated to the new copy after its first run failed.
No visual baselines changed. These are phone-browser checks, not physical-device
certification. No deployment or native packaging changes were made.

Visually inspected screenshots: `evidence/card-tip-2026-09-08/pro-max.png` and
`evidence/card-tip-2026-09-08/se.png`. Raw results: `/tmp/hint-card-tip`.
Temporary production test configuration on port 5193 was removed after the run.
