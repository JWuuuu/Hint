# Hint · Gesture collection v3

A separate prototype with 20 gestures, continuous activities, and two phone-sized scene previews.

Open `preview/index.html` directly in a browser. It contains its own drawings and animation code. No server or network connection is needed. Open `samples/index.html` for all 20 short clips, half-speed playback, and 240 keyframes.

The approved greeting, v1, and v2 are saved for comparison. The approved snapshot is read-only. Builds verify their checksums and write only to v3. Future changes belong in another version.

## Gestures

| ID | Movement |
| --- | --- |
| `idle` | Quiet breathing, blinking, and a small weight shift |
| `welcome` | Rounded-paw wave using the approved greeting’s timing |
| `offer-letter` | Inhale, look at the letter, lean forward, offer, and wait |
| `listening` | Lean toward the user with one short paw near the head |
| `thinking` | Look upward and rest the head near a rounded paw |
| `reading` | Read quietly with a downward gaze and small nods |
| `speaking` | Irregular mouth shapes, eye contact, and small paw emphasis |
| `waiting` | Relaxed attention with occasional glances and weight shifts |
| `wink-left` | Hint’s left eye closes with a cheek lift and body dip |
| `wink-right` | The opposite eye closes with its own timing and body dip |
| `nod` | A clear, gentle yes with the paws drawn inward |
| `shake-head` | A small left-right head turn with a gentle expression |
| `celebration` | Happy crescent eyes, a wider smile, lifted paws, and a soft landing |
| `curious` | Wide eyes, a forward lean, and an outward-looking head tilt |
| `surprised` | A brief pause, round mouth, and slight lean back |
| `shy` | Averted eyes, warmer cheeks, and paws held close |
| `comfort` | Soft eyes, a small lean toward the user, and one offered paw |
| `disappointed` | Lowered eyes, a slow settling movement, and an exhale |
| `frustrated` | A small pout, sideways glance, and a turn away before relaxing |
| `sleepy` | Slow eyelids, a small yawn, a head droop, and a gentle recovery |

Left and right refer to Hint’s own sides. The preview can hide names, the question mark, and sparkles. It also includes 96 px and 160 px sizes, slow playback, a timeline, pause/resume, and saved-version comparisons.

## Letter and scene behavior

The offer takes 2.4 seconds and then waits for acceptance. Acceptance takes 1.8 seconds. The receiving area reaches the letter before the paws release it. The same opaque envelope moves into the reading area; it does not fade out or reappear.

Letter state is `held`, `offered`, or `delivered`. Reactions after delivery use empty paws. Only an explicit reset restores the letter. During an offer or handoff, the most recent activity request waits until delivery finishes.

The letter scene runs welcome → offer → acceptance → quiet reading. The conversation scene runs waiting → listening → thinking → preparation → speaking. Interrupting the reply returns Hint to listening. This scene simulates playback states and does not record or play audio.

Continuous activities have an entrance, a held pose, and an exit. They do not repeat their entrance every few seconds. Pause, background visibility, offscreen suspension, and reduced-motion settings are handled by the same controller clock.

## Reuse

Serve the folder over HTTP when importing its modules. The standalone preview can also be opened as a local file.

```js
import { createHintMascot } from './src/index.js';
import { assets } from './preview/hint-assets.js';

const hint = await createHintMascot(canvas, { assets });
hint.setActivity('listening');
```

`setActivity()` accepts `idle`, `listening`, `thinking`, `reading`, `speaking`, and `waiting`. Use `speaking` while a reply is playing; use `waiting` while preparing it. Use `playGesture(id)` for a one-shot reaction or an offer, and `acceptLetter()` once the offer is waiting. An active one-shot gesture rejects repeat taps. `setActivity()` blends from the current pose and can interrupt ordinary reactions.

The controller also provides `pause()`, `resume()`, `seek(seconds)`, `setSpeed(speed)`, `setAccentsVisible(value)`, `resetScene()`, `getState()`, `getPose()`, and `destroy()`. Seeking pauses playback and does not fire completion or handoff callbacks. Delivery emits one handoff event and one completion event during actual playback.

`getState()` reports the gesture, activity, transition phase, clock, visibility, letter owner, target, and pending activity. An optional `letterTarget` sets the receiving position using normalized canvas coordinates. Type definitions are in `src/index.d.ts`.

## Build and checks

The preview and motion tests use Node.js 20 or newer and no installed packages:

```sh
node scripts/build.mjs
node --test scripts/motion.test.mjs
node scripts/verify-approved.mjs
```

The browser review scripts use Playwright. Image sheets use Sharp. Clip export uses FFmpeg. These are development tools and are not required to open the saved preview or clips. `HINT_PREVIEW_URL` can point the checks at another local server.

Review records are in `evidence/verification.md`. Each action has a normal-speed MP4, a WebM, 12 keyframes, and playback measurements in `samples/<gesture>/`. The six continuous activities also have one-minute recordings in `evidence/videos/`.

The ZIP includes a SHA-256 manifest. The accompanying `.sha256` file checks the ZIP itself. `scripts/package-release.py` refuses to replace an existing release. The separate extracted-release report records the offline browser and independent build checks.

This is a browser prototype. Native app integration and testing on physical phones are separate work.
