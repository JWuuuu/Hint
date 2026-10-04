# Home / Daily ZIP fidelity review — 2026-09-30

The owner reported that Daily no longer looked like `Hint-App-codex-latest-hint-20260928.zip` and explicitly excluded Tarot from changes. This is a bounded follow-up to checkpoint `45796ff`; the expanded iPhone release Goal remains paused.

Implementation: `69d32dccfc4e9cb6acb1b05313ca17a6dae4ac80`, on `codex/merge-home-daily-receipt`. Neither `main`, the original Windows branch, nor the named September 30 checkpoint was replaced.

## Findings and corrections

| Surface | ZIP reference / observed mismatch | Correction |
| --- | --- | --- |
| Daily opening | ZIP begins with period/date controls. The merge still rendered the older Home-back pill, large Daily Sky Card heading and a separate synchronization row before them. | Restore the ZIP's screen-reader-only heading and date-first layout. The persistent Today tab still returns Home. |
| Daily dates | The added `readings.today` label rendered “Tonight”, unlike ZIP's Today / Yesterday / Tomorrow. | Reuse the original localized relative-day formatter. |
| Daily report | A standalone receipt action separated the card preview from the article and pushed the score columns down. | Put a 44px, localized share action beside the card title, including saved historical cards. Keep the actual report snapshot and save eligibility. |
| Home | The merge inserted an extra date above the hero and a standalone receipt row between hero and energy. | Restore the ZIP's logo-led header and uninterrupted hero → energy → evidence → rooms sequence. Put sharing in the header. |
| Home offline status | In the phone frame, the status paragraph began at y=0 and was obscured by the status-bar / island area. | Keep the existing status text in the header's safe content area. The regression failed before the fix (`0 < 59px`) and passes on both phone sizes. |

## Fidelity and deliberately retained behavior

Home's typography, card composition, score row, energy/theme section, decorative background and room tiles come from the ZIP. Daily retains its transparent report surfaces, date carousel, five pastel score columns, article spacing and lucky illustrations. The Home/Daily styles were directly diffed against the reference, and both reference pages were rendered for phone-size inspection.

All **433 matching public assets are byte-identical** to the ZIP; none differ. The only omitted archive public file is its old standalone `iphone17-pro-preview.html`; the current selectable frame already serves that purpose. See `donor-assets.json` for the archive checksum and exact comparison.

This is design fidelity, not a wholesale source replacement or pixel-identical restoration. Existing differences retained intentionally:

- Real locked daily cards, notes, history, sync status and working printer sharing. An unavailable historical score or lucky item is not invented.
- The approved “universe left you a little note” copy and accurate card-reflection explanations. The archive's placeholder personal-chart evidence is not restored.
- Five-language copy, dark-theme adaptation, 44px touch targets, full detailed text and 200% reflow. The ZIP's smaller interactive targets and fixed-height enlarged text are not reintroduced.
- Existing navigation, safe-bottom spacing and room transition behavior.

Tarot room files, deck/card-order logic, reading persistence, identity, daily receipt storage, shared app shell, app chrome and global source stylesheet are unchanged from `45796ff`. The existing `ReceiptShareDialog` implementation is byte-identical (SHA-256 of the prefix before the Daily-only button export: `129fbb677f719b1a9cf35de6cef31522846a78baad5beb3339a120fd3b36cbe8`). Only its `DailyReceiptButton` export gained an optional compact presentation. No Tarot animation, spread, reading request, follow-up, save format or sharing behavior was modified.

## Same-version verification

Source/test fingerprint: `05ca042c04fac3c8e85577c8c12bfe700d0cccdb9f67b8582736960b5fb0ca9d`.

Built-assets fingerprint: `2230afa92a8c2e4fbabac13f91d20e3828a912d9da63b389fde3bd5b9f89c118`.

| Check | Result |
| --- | --- |
| Frontend TypeScript | Passed |
| Production build | Passed; existing large-chunk advisory remains |
| Daily note recovery, card synchronization and localized lucky copy | 19 unit/component cases passed |
| Two-phone dates, periods, statistics, locked-card PNG export, historical/unopened cards and selectable-frame sharing | 14 WebKit cases passed |
| SE, other four languages, both themes, 200% Daily text | 8 cases passed |
| SE, all five languages, both themes, 200%, App and system reduced motion | 10 Home → receipt → Daily cases passed |
| Pro Max, English, both themes, normal motion and 100% text | 2 Home → receipt → Daily cases passed |

Total: **34 targeted browser cases passed, zero failures/skips on the final build**, plus 19 unit/component cases. Top/middle/bottom scroll geometry, complete text, dock labels, receipt focus and close/return, image generation and live card identity are covered by the existing suites. `validation.json` records each selector. The progress registries retain the tested fingerprints; their earlier commit field refers to the uncommitted work later saved unchanged as `69d32dc`.

The new safe-area assertion has a retained pre-fix failure screenshot. Test screenshots and PNG exports use fictional fixtures, with unmocked APIs blocked. The ZIP reference ran separately with no API service. Tests/builds ran sequentially with one worker; no full release matrix, paid provider, real database, deployment or native packaging was run.

## Screenshots and preview

- ZIP [Home](screenshots/zip-reference-home.png) and [Daily](screenshots/zip-reference-daily.png), rendered in the same selectable frame wrapper. Different fictional cards/content are expected.
- Final Pro Max [Home](screenshots/iphone-17-pro-max-phone-home.png) and [Daily](screenshots/iphone-17-pro-max-phone-daily.png).
- Final SE [Home](screenshots/iphone-se-phone-home.png) and [Daily](screenshots/iphone-se-phone-daily.png).
- Dark [Home](screenshots/home-dark.png) / [Daily](screenshots/daily-dark.png), [PNG export](screenshots/daily-receipt.png), and [pre-fix Home status obstruction](screenshots/home-status-before.png).

The existing local phone preview at `http://127.0.0.1:5255/app?hintPreview=frame` now serves `/tmp/hint-home-daily-zip-ui-final-20260930`. Its API remains isolated. Existing preview identity and history were preserved; no local profile or birth fields were edited. Temporary preview builds do not transfer through Git; rebuild from the integration branch on Windows.

This verifies the requested Home/Daily correction, not completion of the paused whole-app Goal. A fresh full-app run, Simulator, physical iPhone and signed candidate remain outstanding as documented in the iOS acceptance handoff.
