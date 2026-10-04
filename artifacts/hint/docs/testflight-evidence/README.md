# RC2 evidence bundle

This directory preserves a small selection of the isolated RC2 verification evidence. It contains synthetic test data, source/asset hashes and test logs; it does not contain environment files, device credentials, invitation tokens or production records.

- Runtime/configuration/assets manifest SHA-256: `619ab5e3325f2a22505ea648677ad90097fa0e6258268ce5a31a23cf41a66fb0`.
- Built web assets manifest SHA-256: `4d271fc8b145e350e71db1467e984a6ffc851347800536e68fb90eac024ca066`.
- Frontend: 414 tests in 49 files passed.
- API and isolated PostgreSQL: 47 tests in 8 files passed, including migration and access-isolation integration cases.
- Release configuration/native-asset scripts: 6 tests passed.
- Frontend/API/library type checks and both builds passed. The main web chunk is 904.51 kB (302.81 kB gzip); a large-chunk build warning remains.
- Native source preflight passed. This is static validation, not a compiled Simulator or signed iPhone build.

The screenshots are unmodified captures from the same RC2 build. `screenshots.json` records original paths and per-image hashes. Normal navigation captures may include the profile header during its entry fade; the subsequent 200% capture shows the settled header. These images inspect navigation bounds, not full-screen contrast. Normal scrolling can leave content partly beneath the fixed navigation in top/middle views; the bottom screenshots and interaction tests establish final-content reachability. A 200% navigation capture enlarges navigation text specifically; it is not evidence that every screen was rendered with 200% Dynamic Type.

Screenshots include Pro Max navigation in all five languages at normal and 200% text, Spanish/Japanese Daily at top/middle/bottom, and the bottom of the Spanish/Japanese Home reveal at 200% text. The reveal summary intentionally ends in an ellipsis and offers an interpretation detail action; its final return action is reachable. At 200%, long navigation words wrap; reviewed labels remain inside their targets. Visual asset polish: [the Spanish Daily bottom capture](screenshots/promax-es-bright-app-daily-bottom.png) shows the small baked English “Pen-point” label from [`public/lucky/carry/pen.png`](../../public/lucky/carry/pen.png). The artwork is unchanged. This is a minor artwork-language limitation, not a broken main flow or an inferred translation-resource error; the report does not claim every bitmap pixel is localized. Asset-rights and licensing review remains a separate release gate.

SE 375×667 captures also include Spanish/Japanese navigation at normal and 200% text, and Daily at 200% (top, middle, lucky items and bottom). Period controls reflow into two rows, Japanese date suffixes flow onto another line, and long accessories remain complete. The final note field is above navigation; its fixed textarea viewport shows only part of the enlarged placeholder. This is recorded as a limited visual caveat, not evidence of lost saved note content or a navigation obstruction. Physical keyboard/editing and Dynamic Type remain separate unverified gates.

The complete E2E result accounting and any later additions are recorded in the parent candidate and coverage documents. No release-ready decision follows from this bundle alone: real HTTPS/API/download settings, Apple Team ID, full Xcode/SDK, signing and physical-device acceptance are still required. No deployment, upload, paid provider run or production migration was performed.
