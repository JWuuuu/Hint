# RC3 final-candidate evidence

RC3 follows RC2 after one targeted change: the Tarot receipt card thumbnail now receives its existing localized orientation accessible label. No Tarot drawing or reading mechanics changed between these candidates. The prior RC2 evidence remains in the parent directory and is not relabeled as RC3.

- Runtime/configuration/assets manifest SHA-256: `cb5ff5d514bcd31b8b7db88e933511fc46fb95329bc4eac4a18be1d4bbc5b18c`.
- Built web assets manifest SHA-256: `1c3e5a3e61553a6eb743d668be658b955ce99c7e70d0eec2c8e144414674f53c`.
- Final test/helper/config manifest SHA-256: `0cbc4e88364c89c1585136a3a248f8fb4c06cb9dcb27bce9cd257e695b2f7ccc` (96 files).
- Handoff verification matched all 1,356 runtime files and 498 built assets between the workspace and frozen candidate, without extra unlisted build files.
- Newly rerun frontend: 414 tests in 49 files passed.
- Newly rerun release configuration/native-asset scripts: 6 tests passed.
- Frontend/API/library type checks, launch timing check and both builds passed. An empty successful typecheck log is expected.
- Native source preflight passed; this is static validation, not a Simulator or physical-device build.

API/database evidence is retained from the prior isolated PostgreSQL run: 47 tests in 8 files passed. `retained-api-evidence-proof.json` confirms that every API/library runtime file covered by the manifests and all eight API test files are byte-identical between RC2 and RC3, and records the original log digest. The retained evidence is not described as a newly executed RC3 database suite.

The dedicated Tarot E2E run accounts for 152 cases: 140 passed and 12 intentionally skipped per phone/test scope (see `rc3-tarot.json`/`.log`). The dedicated sharing/touch E2E run passed all 26 cases. Matching SE Spanish Tarot preview/export and English/Japanese Personality PNGs are preserved with per-file hashes in `screenshots.json`. The PNG QR URLs belong to the isolated localhost fixture; they are not approved public release URLs. English generated reflections are explicitly marked as original English.

Matching RC3 SE Spanish/Japanese Daily (top, middle, lucky items and bottom) and navigation (normal and 200%) are also preserved. At 200% text, periods reflow, Japanese date suffixes occupy another line, and accessories wrap fully. The final note field remains above navigation; the enlarged placeholder is partly clipped within its fixed textarea viewport. This limited visual caveat is retained rather than called a lost-data or navigation issue. Normal navigation captures can show the profile entry fade and are not full-screen contrast evidence. The final locale run also supplies normal-size Pro Max Spanish/Japanese Daily top/middle/bottom captures. Some artwork has baked English labels (for example, “Glasses”); this remains visual asset polish and is not misreported as a missing translation-resource key. The report does not claim every bitmap pixel is localized.

The raw first RC3 main run is preserved as `rc3-main-initial.json`/`.log`: 215 passed, 8 skipped and 1 native WebKit diagnostic failure. The new trace timing proof and prior standalone plain-HTML probe are preserved. `surface-harness-check.cjs`/`.json` verify the narrowly bounded test-only classification and continued observation of true window errors and unhandled rejections. 

The complete 16-case locale surface suite then passed against unchanged RC3 assets, covering 304 route visits with zero other pageerrors and zero true window errors/unhandled rejections. Two exact native diagnostics occurred 5.272 ms and 3.302 ms into SE Daily→Astrology navigations and remain recorded, not hidden. All 16 detailed reports, summary, final JSON and final log are preserved. The isolated browser/preview exited successfully and port 5196 was released before the separate performance run. 

The subsequent standalone motion run passed 8/8 cases. Final registry accounting matches the full 410-case inventory: 390 passed, 20 intentionally skipped, zero missing/duplicate cases, zero failures and zero flaky/retried final cases. This combines 208 non-locale main cases, 16 replacement locale cases, 152 Tarot cases, 26 sharing/touch cases and 8 motion cases. `aggregate-rc3.py` reproduces the accounting from the preserved reports; the main report is deliberately named `rc3-main-initial.json` to retain the original failure. The parent candidate and coverage documents describe the exact skip boundaries and remaining physical-device gates. No screenshots from an earlier candidate are relabeled as RC3.

The standalone host WebKit measurement includes 40 windows and 4,529 RAF gaps. Per-window p95 ranged from 18–29 ms, the maximum gap was 68 ms, and none reached 100 ms. The 32 interaction windows had p95 values of 18–27 ms. These are per-window ranges, not a pooled p95. The summary and all 40 per-window metric records are preserved with hashes. These records contain aggregate sample counts, percentiles, maxima and stall counts; individual RAF interval arrays were not persisted, and duplicate attachments are omitted. This is browser regression evidence on the macOS host; physical iPhone frame timing, touch latency, battery behavior and native release thresholds remain unverified.

No deployment, TestFlight upload, production migration or paid provider run is included. Required release settings, Apple Team ID, full Xcode/SDK, signing, physical-device behavior and asset-rights review remain separate gates.
