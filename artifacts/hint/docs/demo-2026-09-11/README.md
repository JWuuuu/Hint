# Hint — quick app demo

A short portrait demonstration of the current local Hint candidate: Home, the Tarot question/spread/wash/pick/reveal journey, Astrology and the Me page. The film uses the existing iPhone 17 Pro Max frame and Pearl Moonlight palette, with English editorial captions around the actual app.

- Deliverable: `Hint-App-Demo.mp4`, approximately 48 seconds, 1080×1920, H.264, 25 fps. Silent; no voiceover or music.
- `Hint-App-Demo-Poster.png` is the poster image. `contact-sheet.jpg` is a visual review sheet.
- Every profile and calculation shown is illustrative demo data. No real user records or live/paid APIs were used. The chart caption identifies the sample explicitly.
- The room arrival and Tarot gestures are recorded from the app. Cuts shorten setup and navigation between the featured scenes; this is an edited product demonstration, not a continuous performance benchmark or native-device recording.
- App product source was not modified. The external phone-stage styling and captions exist only in the isolated recording context.

The candidate is served locally on port 5234. Its product-source digest is `db14065591dfd564343b19d6e7553a42c63a4584080d7fe0b78ab91e8e9bdb56`. `capture.mjs` records in a separate Playwright context and blocks all real API traffic. `render.py` edits and encodes the captured footage with a temporary FFmpeg runtime, without changing project dependencies. `timeline.json` and `edit.json` retain the chapter timing.

This artifact has not been published, sent to another person, or uploaded to a social/video platform.
