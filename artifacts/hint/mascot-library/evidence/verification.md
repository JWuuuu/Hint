# Verification

- All 35 files in the approved snapshot match their saved SHA-256 checksums and are read-only. The original greeting’s checksum is `fbda0c5e0722a0a9f706b1323336f3d4a704d2cb91252e28e5eca42725200191`.
- Seven motion tests pass: neutral endpoints, independent winks, matching offer/delivery poses, valid paw geometry, empty-paw rest, continuous timing, and snapshot protection.
- Chrome and WebKit pass the interaction checks recorded in `browser-checks.json`, including touch, keyboard, pause/resume, repeated taps, letter acceptance, completion callbacks, reduced motion, visibility suspension, and layout at 320, 390, 430, and 736 pixels.
- The frame audit covers 697 character frames. Each has one connected main silhouette, including the paws. The moving envelope is excluded from the character-connectivity check after release.
- All eight motion phases also complete at half speed with steadily advancing animation time. Median frame intervals in the local Chrome run are about 16.7 ms. This measures local browser playback, not native-device performance.
- Frame contact sheets cover every gesture. The letter sequence uses a cleaned torso and reconstructed paper beneath the paws, and the initial pose change is blended during anticipation.
- A relocated standalone copy loads and runs with network requests blocked. Network fonts have local fallbacks.

This is a saved prototype collection. It has not been integrated into app screens or tested on a native device.
