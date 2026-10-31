# Hint Windows checkpoint — October 12, 2026

This checkpoint contains the current Tarot flow, **Read My Hint** reading and voice work, and **Hint mascot v3.2**. It matches the working app shown on Mac.

- Repository: https://github.com/JWuuuu/Hint
- Working branch: `merge-home-daily-receipt`
- Full download: https://github.com/JWuuuu/Hint/releases/tag/windows-checkpoint-2026-10-12
- Choose **hint-windows-2026-10-12.zip** under Assets. This contains the app, API, shared packages, all mascot source and artwork, playable previews, reviewed samples, and every frozen animation backup ZIP.

GitHub's automatic Source code ZIP and a normal clone contain the working source, artwork, previews and review files. The full checkpoint ZIP additionally contains the 11 original mascot backup ZIPs, including the large archives that are kept outside Git. Use the full checkpoint for an exact animation-library copy.

## Start on Windows

Install Node.js 24 and extract the full ZIP to a short path such as `C:\dev\Hint`. Open PowerShell in that folder:

```powershell
Set-Location C:\dev\Hint
node --version
node scripts/verify-download.mjs --restore-protection
npm.cmd install --global pnpm@11.5.0
pnpm.cmd install --frozen-lockfile
$env:VITE_HINT_GUIDE_V32 = '1'
pnpm.cmd run dev:web
```

Open:

- Welcome, wave and tap-to-wink: http://localhost:5173/app?hintGuide=v3.2&onboarding=reset
- Tarot and Read My Hint: http://localhost:5173/app/tarot?hintGuide=v3.2
- Ask Hint: http://localhost:5173/app/ask?hintGuide=v3.2

The mascot preview flag is opt-in. Set `VITE_HINT_GUIDE_V32=1` in each terminal used to build or run this preview. `onboarding=reset` is for replaying the welcome; leave it out for ordinary use.

The verification command checks every packaged file before restoring saved read-only permissions. Windows extraction tools may not preserve those permissions themselves. `CHECKPOINT-MANIFEST.json` records the exact commit and per-file checksums; `SHA256SUMS.txt` beside the download records the ZIP checksum.

For a Git checkout instead of extracting the full ZIP:

```powershell
git clone -c core.autocrlf=false --branch merge-home-daily-receipt https://github.com/JWuuuu/Hint.git C:\dev\Hint
Set-Location C:\dev\Hint
```

Then run the install and preview commands above, omitting `verify-download.mjs`. To restore the frozen backup archives into a clone, copy only `artifacts/hint/mascot-library` from the full checkpoint at this same revision. Do not overwrite later work with an old ZIP. The frozen library verification also checks backup files, so it needs the complete download.

## Animation previews without installing dependencies

Open these files in a browser after extracting the full ZIP:

- `artifacts/hint/mascot-library/versions/v3.2/preview/journey.html` — entrance, welcome, profile and letter study.
- `artifacts/hint/mascot-library/versions/v3.2/preview/letter.html` — foreground letter handoff and opening.
- `artifacts/hint/mascot-library/versions/v3.2/preview/conversation.html` — conversation and voice states.
- `artifacts/hint/mascot-library/versions/v3.2/preview/index.html` — 20-gesture inspector and comparisons.

The original greeting and v1, v2, v3 and v3.1 are retained. Their source bytes and backup checksums remain unchanged. The 20-gesture inspector still uses its earlier letter receiver; use `letter.html` for the newer letter study.

## What is connected

The app includes the latest question-first Tarot reading structure, card connections, Read My Hint chat layout, message actions, dictation, speech playback and voice conversation. The mascot is connected to the welcome/profile flow, Ask Hint and Tarot voice behind the preview flag.

The first welcome waves and responds to a click, tap or keyboard activation with a wink. The same canvas moves into the profile form. Conversation states follow waiting, listening, thinking, reading and actual speech playback.

Home delivery with the real daily card, the final review of all 20 gestures under the shared transition system, and native-device acceptance are still unfinished. This is a development checkpoint, not a production release.

## API and saved data

The frontend runs without copying Mac credentials. Live readings, backend history and speech services need the API and its environment configuration. See [LOCAL_SETUP.md](LOCAL_SETUP.md) and `.env.example` for the variables. Keep secrets in a local `.env`; they are not included in Git or the download.

For the API on Windows, after configuring a development database and the required environment variables:

```powershell
$env:NODE_ENV = 'development'
$env:API_PORT = '5050'
pnpm.cmd run build:api
pnpm.cmd run start:api
```

The frontend proxies `/api` to port 5050 by default. This checkpoint does not transfer browser localStorage, saved personal readings, Keychain entries, databases, dependencies or private credentials. Install dependencies fresh on Windows.

## Checks and continuation

Run source checks from the repository root:

```powershell
pnpm.cmd run typecheck:web
pnpm.cmd run build:web
pnpm.cmd --filter @workspace/hint exec vitest run src/components/mascot/HintGuide.test.tsx src/components/mascot/hintGuideContext.test.ts src/modules/tarot/components/TarotVoiceConversation.component.test.tsx
node artifacts/hint/mascot-library/versions/v3.2/scripts/verify-approved.mjs
```

The frozen checks require the complete library and restored read-only permissions. The current motion tests use Node's built-in test runner; their command is in `artifacts/hint/mascot-library/versions/v3.2/package.json`.

Current implementation status and browser evidence are in `artifacts/hint/mascot-library/versions/v3.2/iterations/work-state.json` and its linked review files. Browser voice checks used simulated recognition and playback. Windows execution and physical-phone microphone, performance and lifecycle checks remain separate from the Mac browser results. iOS signing and packaging require the Mac toolchain.

Earlier merge and phone acceptance records remain in `artifacts/hint/docs/`. The September handoff is retained in Git history; use this document for the current download, branch and preview routes.
