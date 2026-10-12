# Hint gestures v2

Open `preview/index.html` to try the seven gestures. The preview includes playback, pause, a timeline, normal/half/quarter speed, 160 px and 96 px sizes, and controls to hide gesture names or decorative accents. The saved v1 collection and the approved greeting are available below the preview.

This is a separate prototype. It does not change the app’s screens or the saved v1 collection.

## Gestures

| Gesture | Expression and movement |
| --- | --- |
| Left wink | Hint’s left eye closes, with an asymmetric smile and body dip. |
| Right wink | The opposite eye closes with its own smile and opposite dip. |
| Nod | A downward acknowledgment, closed eyes, reassuring smile, and inward paws. |
| Listening | Wider eyes, a quieter mouth, a sideways lean, and one paw raised beside the head. |
| Thinking | Upward gaze, a pursed mouth, and the opposite short rounded paw near the cheek as the head leans toward it. |
| Celebration | Crescent eyes, a wide smile, raised paw, and a soft lift and landing. |
| Offer a letter | Hint looks at the letter, then at the reader, and waits for acceptance. |

Left and right refer to Hint, so its left eye is on the viewer’s right. Thinking’s question mark and celebration’s sparkles can be hidden without changing the underlying performance.

The letter stays in Hint’s paws until **Take the letter** is pressed. After delivery, reactions keep the paws empty. **Reset letter** starts another offer. **Reset scene** returns to the holding pose. Repeated taps do not restart active movement.

## Reuse

Use the v2 renderer and v2 asset bundle together.

```js
import { createHintMascot } from './src/index.js';
import { assets } from './preview/hint-assets.js';

const canvas = document.createElement('canvas');
canvas.width = canvas.height = 768;
canvas.style.width = '320px';
document.body.append(canvas);

const hint = await createHintMascot(canvas, {
  assets,
  onComplete: ({ gesture, letter }) => {
    console.log(gesture, letter);
  },
});
hint.playGesture('thinking');
```

The existing controls remain: `playGesture`, `acceptLetter`, `resetScene`, `pause`, `resume`, `seek`, `setSpeed`, `getState`, `getPose`, and `destroy`. `setAccentsVisible(boolean)` controls the question mark and sparkles. Type declarations are in `src/index.d.ts`.

`playGesture` and `acceptLetter` return `false` for invalid transitions. Active or partly scrubbed movements cannot be replaced; resume them or explicitly reset. An offered letter waits for acceptance or reset. `onComplete` fires once per completed playback phase; scrubbing alone does not emit it. Completing the offer means waiting, while completing delivery means the letter has left the paws.

Movement pauses when the page is hidden or the character is offscreen. Reduced motion starts with a still character; a requested gesture plays once and stops. Call `destroy` when removing the character.

## Build and preservation

```sh
npm run verify
npm run build
npm test
npm run package
```

Build and verification use Node’s built-in libraries. Packaging uses Python 3. Prepared artwork is included. The HTML preview embeds its art and code, including both saved comparisons, and loads independently of the original working folder. Fonts fall back to local fonts offline.

`approved/v1/` contains the exact read-only greeting and its source assets. `baseline/v1.html` contains the unchanged v1 collection preview. In the original workspace, verification also checks every protected v1 source, asset, preview, and release against the saved manifest. Builds write only within this v2 folder. Packaging refuses to replace an existing release.

Expression preparation is in `scripts/prepare-expressions.mjs`; the short rounded thinking and listening paws are prepared in `scripts/prepare-connected-paws.mjs`. Source artwork and exact edit prompts are in `assets/inputs/`. The original eye texture and approved celebration paw drawing are reused. Mouth contours, cheek emphasis, gaze, head leaning, and paw poses share the gesture’s playback clock and body transform.

## Review

`evidence/verification.md` records the review and checks. The folder includes normal and half-speed captures, unlabeled pose comparisons, facial drawings, phone-width screenshots, and machine-readable results.

Browser checks require Playwright with Chrome and WebKit. Asset preparation and contact sheets require Sharp. `HINT_TOOLS_PACKAGE` can point to a package providing Sharp; `HINT_PREVIEW_URL` can select a different served preview URL.

The checks cover the browser prototype. Native-device performance and app integration are separate work.
