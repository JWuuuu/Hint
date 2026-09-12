# Journal quality pass — September 8, 2026

Scope: `/app/journal`. No Tarot implementation changes.

## Result

- Draft title, body, and mood are saved on the current device per anonymous identity. Navigation and refresh restore them. Storage failure is shown explicitly.
- Save failures preserve writing and display a recovery message. Saving locks the form and guards duplicate submissions. Confirmed entries are added to the query cache before history refresh, so a failed refresh does not hide the saved page.
- History loading, empty, and error states are distinct, with a retry action.
- Title/body limits match the existing API (200/8,000 characters). Labels, focus indicators, 16px writing controls, 44px mood targets, themed surfaces, and wrapping improve phone use.
- New labels and statuses are available in all five existing app languages.

## Validation

- `pnpm --filter @workspace/hint exec vitest run src/modules/features/journalDraft.test.ts` — 4 passed.
- `pnpm --filter @workspace/hint exec playwright test e2e/journal.spec.ts` — 10 passed across WebKit at 375×667 and 440×956. Covers draft restoration, failed-save retry, failed-history retry, retained confirmed pages, input limits, overflow, and accessibility in bright/dark themes with reduced motion.
- `pnpm --filter @workspace/hint run typecheck` — passed.
- `pnpm --filter @workspace/hint run build` — passed; Vite still reports a large main bundle.
- `git diff --check` — passed.
- Manually reviewed the running app in selectable Pro Max and SE frames, including scrolling to the save button and empty history. Temporary onboarding bypass was removed after review.

API writes/failures in automated tests use controlled responses; these tests do not prove production database availability or physical iPhone keyboard behavior. Drafts are device-local; completed entries continue to use the existing Journal API. A lost network response can leave a save outcome uncertain, so recovery copy asks the user to check past pages before retrying.
