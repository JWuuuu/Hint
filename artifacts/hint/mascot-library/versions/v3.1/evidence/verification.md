# Hint v3.1 review

This version separates the expressions through head rotation, body posture, paw movement, facial drawings, and timing. It also adds perspective to the letter offer and keeps the gripping paws in front until the envelope moves clear of them.

The approved greeting and the saved v1, v2, and v3 collections remain unchanged. The build verified 35 approved files, 99 protected v1 files, 641 protected v2 files, and 1,000 protected v3 files, including the v3 release archive.

## Motion and appearance

- All 20 gestures and the internal delivery movement were played at normal and half speed. The clock remained monotonic in all 42 runs. Recorded frame intervals were approximately 16.7 ms on the review machine.
- Visual review used sampled frames from playback, the main poses with names and decorative accents hidden, 96 px and 160 px versions, and the empty-paw poses. The per-gesture observations are in `gesture-review.json`.
- The six continuous activities each ran for 60 seconds without restarting their entrance. Their recordings and sampled poses are included.
- Twenty activity transitions were sampled with held and delivered letters at both playback speeds, producing 140 transition frames.
- The connected-character audit covered 3,726 rendered samples. Each had one connected body-and-paw silhouette with the envelope hidden for the check.
- The actual body, face, and paw shader transforms were checked across 2,378 motion samples per mesh. All sampled triangles retained positive area.
- Sixteen motion tests passed, including eye independence, distinct head/body/paw actions, contact points, continuous motion, unscaled paw volume during the envelope tilt, delivery state, and activity transitions.
- The disappointed and frustrated face drawings were checked directly: their mouth centers curve upward relative to their corners, producing downturned expressions. The neutral mouth retains its smile.
- The handoff was sampled immediately before and after the ownership change in Chrome and WebKit. After fixing the drawing order, neither browser showed a patch of the paw being abruptly covered by the envelope.

## Browser behavior

Chrome and WebKit passed the 320, 390, and 430 px layout checks, touch and keyboard controls, repeat-tap protection, pause/resume, reduced motion, simulated document background suspension, and actual offscreen suspension. Both browsers loaded the saved v3, v2, v1, and approved greeting comparisons.

The new held-expression control was checked in both browsers. It pauses on the main pose and permits switching to another reaction. Reading resumes correctly when selected as an activity.

Both complete scene previews passed: welcome through letter acceptance and reading, and waiting through listening, thinking, reply preparation, speaking, and interruption. A scene switch preserves the delivered letter and queues the latest activity during a handoff.

The 20 exported H.264 clips load in Chrome and WebKit. The gallery supports half-speed playback, hiding names, and phone widths. Its 240 keyframes are extracted from the saved videos.

## Saved package

The release includes the source, assets, comparisons, standalone preview, clips, keyframes, and these review records. Its SHA-256 manifest covers each packaged file. The accompanying archive checksum and extracted-release report are saved beside the ZIP.

These checks cover the browser prototype. Native app integration and physical-device testing are outside this revision.
