# Hint v2 review

Reviewed on October 12, 2026. This collection contains seven public gestures and the letter’s separate release animation.

## Visual review

Each gesture was reviewed at normal speed, half speed, and twelve sampled moments. The six reactions were also checked after delivery, with empty paws. Unlabeled views were inspected at 220, 160, and 96 px with the question mark and sparkles hidden.

| Gesture | Reviewed performance |
| --- | --- |
| Thinking | A short, single rounded paw rises toward the lower cheek. The head and upper body lean toward it, the gaze lifts, and the mouth purses. The paw stays broad during the return. |
| Listening | The opposite paw lifts beside the head while the head and body lean toward it. Open eyes and a quiet mouth hold the attentive pose. The other paw supports the letter. |
| Nod | Brief upward preparation, a deliberate downward nod, reassuring closed eyes, inward paws, and a gentle return. |
| Celebration | Crescent eyes, a wider happy mouth, a paw lift, buoyant rise, and soft landing. Both paws lift when empty. The action remains readable without sparkles. |
| Left wink | One eye closes with an asymmetric smile and coordinated dip; the opposite eye stays open. |
| Right wink | The opposite eye closes independently, with the smile and dip on the other side. |
| Offer a letter | Gaze moves from the envelope to the reader. Both paws bring the envelope forward and hold it until acceptance. The gaze briefly follows the departing letter, then Hint settles with empty paws. |

Thinking and listening use dedicated paw drawings. The tall mirrored waving paw is no longer used for thinking. Their new drawings were checked for narrow fingers, separated wrist shapes, floating edges, and changes in paw thickness. Sampled transitions showed continuous attachment, clean facial placement, and no doubled eyes or mouth. Delivery kept the envelope attached until release and did not recreate it afterward.

The pose sheets supplement the interactive preview; they do not replace review of the movement. These are prototype review results, not a new user approval of the character design.

## Functional checks

- Nine motion and preservation tests passed, including neutral entry/exit, independent winks, continuous keyframe velocity, positive paw triangles, and matching offer/delivery transitions.
- All 1,248 rendered attachment samples contained one connected character component, with the envelope and decorative accents excluded from the measurement.
- The actual body shader was sampled at 697 times for each of the body, paw, and face transform modes. Each sample contained 39,200 valid triangles, with no inversion or non-finite coordinates.
- Twenty-eight timed playbacks covered normal and half speed, including the empty-paw reactions. Time advanced monotonically, with no page errors. The highest recorded 95th-percentile frame interval was 16.8 ms on the review machine.
- Chrome and WebKit passed at 320, 390, and 430 px phone widths, plus 736 px. Checks covered touch, keyboard, repeated taps, pause/resume, seeking, completion callbacks, hidden labels, hidden accents, 96/160 px previews, and letter-state preservation.
- Background behavior was checked with simulated page-visibility events and actual offscreen suspension. Reduced motion started still and stopped after an explicitly requested gesture.
- Both saved comparisons loaded. A relocated standalone preview loaded without network access to its fonts and retained the letter interaction.

The results are in `browser-checks.json`, `playback-review.json`, `frame-audit.json`, `body-mesh-audit.json`, and `expression-inspection.json`. These checks cover desktop browser engines at phone widths; they are not physical-phone performance measurements.

## Preservation and release

The 35 protected greeting files remain unchanged and read-only. Verification also checks the saved v1 comparison and, in the working library, 99 original v1 files. The approved greeting’s SHA-256 is `fbda0c5e0722a0a9f706b1323336f3d4a704d2cb91252e28e5eca42725200191`.

The release includes its file manifest. Packaging checks every archived file, preserves read-only permissions for the approved files and archive directories, and refuses to overwrite an existing release. The archive’s SHA-256 is saved beside it.

`scripts/check-extracted-release.mjs` verifies an extracted package, rebuilds it independently, compares all three preview outputs byte for byte, runs the motion tests, and exercises both browser engines offline. Its release-specific result is saved beside the archive after extraction.
