# Hint v3 review

All 20 gestures passed the prototype review. Each was checked at normal speed, half speed, and sampled frames. Names, question marks, and sparkles were hidden for the pose comparison.

| Gesture | Visual review | What was checked |
| --- | --- | --- |
| `idle` | Passed | Quiet breathing and natural blinks; no repeated entrance. |
| `welcome` | Passed | Approved wave timing; short rounded paw stays attached, including the empty-paw transition. |
| `offer-letter` | Passed | Breath and forward offer; the receiver reaches the envelope before release. The letter stays opaque. |
| `listening` | Passed | Whole-body side lean, attentive eyes, and one rounded paw near the head. |
| `thinking` | Passed | Upward gaze, pursed mouth, and a short paw near the cheek; readable with the question mark hidden. |
| `reading` | Passed | Downward eye scan and small nods, with a quiet mouth. |
| `speaking` | Passed | Irregular mouth openings and small paw emphasis; separate from quiet reading. |
| `waiting` | Passed | Relaxed paws, slow glances, and small weight shifts. |
| `wink-left` | Passed | Hint’s left eye closes independently with a cheek lift and body dip. |
| `wink-right` | Passed | The opposite eye closes with separate timing and the opposite dip. |
| `nod` | Passed | A deliberate dip with closed eyes and inward paws. |
| `shake-head` | Passed | A gentle side-to-side head turn with a restrained expression. |
| `celebration` | Passed | Crescent eyes, a wider smile, a short paw lift, and a soft landing; readable without sparkles. |
| `curious` | Passed | Wide eyes and an outward-looking forward lean, distinct from thinking. |
| `surprised` | Passed | Round mouth and brief backward lean; the mouth contour stays rounded. |
| `shy` | Passed | Warm cheeks, lowered averted gaze, and close paws. |
| `comfort` | Passed | Soft eyes and a short offered paw rotating from the shoulder. |
| `disappointed` | Passed | Lowered eyes, a small frown, and a slow exhale. |
| `frustrated` | Passed | Small pout, sideways gaze, and a brief turn away before relaxing. |
| `sleepy` | Passed | Slow eyelids, a small oval yawn, a head droop, and a gentle return. |

## Continuous activities

Idle, listening, thinking, reading, speaking, and waiting each ran for at least 60 seconds. Their clocks continued without restarting the entrance. The one-minute recordings and sampled states are saved in `activities/` and `videos/`.

## Browser and scene checks

Chrome and WebKit passed at 320, 390, and 430 px. Checks covered all 20 actions, 44 px controls, touch, keyboard activation, repeat taps, pause/resume, reduced motion, simulated background visibility, and actual offscreen suspension. The 96 px and 160 px previews were also inspected.

Both scene sequences passed: welcome through accepted letter and quiet reading; waiting through listening, thinking, preparation, speaking, interruption, and return to listening. Switching scenes after delivery kept the empty paws. A scene request made during handoff waited until delivery finished.

All 20 H.264 clips loaded, sought, and played in both browser engines. The gallery’s half-speed control and hidden-name view passed.

## Geometry and continuity

3,726 raster samples retained one connected character silhouette. Both held-letter and empty-paw reactions were included. The body, paws, and face also passed transformed-mesh checks at 2,378 time samples each, with no inverted triangles.

Twelve motion tests passed, including paw geometry, contact anchors, neutral boundaries, independent eyes, opaque delivery, velocity continuity, sustained poses, and activity transitions. Five transition pairs were inspected at normal and half speed, with and without a held letter. The wave can transition into thinking without a folded contour.

The receiving area reaches the letter before release. At handoff, the envelope keeps the current body offset, then moves into the receiving area. The handoff event fires once. Seeking does not emit handoff or completion callbacks.

## Preserved versions

Checksums match 35 approved files, 99 protected v1 files, and 641 protected v2 files. The approved snapshot remains read-only.

`approved/v1/hint-drawn-paw.html` SHA-256:

`fbda0c5e0722a0a9f706b1323336f3d4a704d2cb91252e28e5eca42725200191`

## Saved package

The package includes the source, drawings, standalone preview, saved comparisons, 20 short clips, 240 video keyframes, and these review records. The ZIP manifest checks every included file. The extracted-release report beside the ZIP records independent rebuilding and offline Chrome/WebKit checks.

These results cover the browser prototype on this Mac. Native app integration, physical phone behavior, real microphones, and real voice playback were outside this review.
