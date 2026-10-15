# Hint gestures

Open `preview/index.html` to try the collection. It includes two winks, a nod, listening, thinking, a small celebration, and an interactive letter offer. Left and right refer to Hint’s eyes, so its left eye is on the viewer’s right.

The letter stays in Hint’s paws until **Take the letter** is pressed. After delivery, the other reactions keep the paws empty. **Reset letter** starts a new offer; **Reset scene** returns to the original holding pose. Playback speed and the timeline are under **Inspect the movement**.

## Approved greeting

`approved/v1/` contains the exact approved wave, its original code, source drawings, textures, and verification records. Its files are read-only. `releases/hint-approved-v1.zip` is the separate backup. The original greeting is also available in the preview’s comparison section.

New work belongs in `src/` and `assets/`. The build checks the approved files before and after writing the preview and never writes into `approved/`.

```sh
npm run verify
npm run build
npm test
npm run rebuild:approved
```

These commands use Node’s built-in libraries. The preview embeds its artwork and animation code and can be opened directly. Typography uses Google Fonts when available and falls back to local fonts offline.

The approved rebuild writes a separate file under `releases/` and verifies that its bytes match the frozen greeting. It uses only the saved inputs in this library. `npm run package` uses Python 3 to create a checksum-verified release archive and refuses to overwrite an existing version.

## Reuse

The collection is a separate prototype library; it does not change the app’s current screens.

```js
import { createHintMascot } from './src/index.js';
import { assets } from './preview/hint-assets.js';

const canvas = document.createElement('canvas');
canvas.width = canvas.height = 768;
canvas.style.width = '320px';
document.body.append(canvas);
const mascot = await createHintMascot(canvas, { assets });
mascot.playGesture('wink-left');
```

Use a square canvas, with a 768 × 768 backing size for the supplied artwork. `createHintMascot` resolves after the textures and renderer are ready; initialization errors reject the promise. The preview displays a still image if graphics cannot initialize.

`playGesture` and `acceptLetter` return `false` for an invalid transition. Active or partially scrubbed gestures cannot be replaced; resume them or explicitly reset the scene. Repeated clicks do not restart a movement. `onComplete` fires once when playback finishes a motion: completing the offer means waiting, while completing delivery means the letter has left the paws. Scrubbing alone does not emit completion.

`pause`, `resume`, `seek`, `setSpeed`, `getState`, and `getPose` support review controls. `resetScene` is an explicit reset, not a character movement. Call `destroy` on removal. Type declarations are in `src/index.d.ts`.

Automatic movement pauses when hidden or offscreen. Reduced motion starts with a still character; an explicitly requested gesture plays once and stops.

## Asset preparation and review

Prepared textures and geometry are included, so ordinary builds do not need image-processing dependencies. `scripts/prepare-letter.mjs` rebuilds the letter assets from the saved inputs with Sharp. `scripts/review-gestures.mjs` uses Sharp and Playwright to capture motion frames. `scripts/check-browsers.mjs` uses Playwright with Chrome and WebKit, against the preview served at `http://127.0.0.1:8767/preview/index.html` by default. `HINT_PREVIEW_URL` selects another local preview address; `HINT_TOOLS_PACKAGE` can point to a package that provides Sharp.

The browser checks cover the preview and reusable interaction behavior. They do not establish native-device performance or app integration.
