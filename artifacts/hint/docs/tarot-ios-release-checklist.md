# Tarot Room iOS Release Validation

This checklist covers the native evidence that browser and responsive preview tests cannot prove. Do not publish or submit the app from this checklist.

## Automated Preflight

1. Install the current Xcode release and select its developer directory.
2. Set a real Hint download URL in `.env.mobile` or the command environment.
3. Run:

   ```sh
   pnpm --filter @workspace/hint mobile:ios:check
   ```

The command validates the iOS source integration, builds the mobile bundle, syncs Capacitor, confirms the iPhone Simulator SDK, and performs a code-signing-free Simulator build.

## Simulator Matrix

Run the complete Tarot journey on both targets:

- iPhone SE-sized simulator with the smallest supported portrait viewport.
- Current iPhone Pro Max simulator with Dynamic Island and safe areas.

For each target, verify question entry, spread recommendation, room setup, manual wash, Auto Wash, automatic cut, post-cut shuffle, compact arc, pinch expansion, card selection, reveal, generated reading, follow-up chat, save, History restoration, and receipt preview.

## Physical iPhone Checks

- Clean install: microphone and speech prompts appear only after tapping voice input.
- Permission denial: typed input remains available and Settings guidance is understandable.
- Dictation: partial text updates while speaking, final text remains editable, and stopping leaves no active microphone indicator.
- Dictation startup: dismiss the sheet while permissions or microphone startup are pending; granting permission afterward must not restart recording or populate another question. Natural completion must leave the transcript available to use.
- Audio route: start dictation immediately after connecting or disconnecting Bluetooth audio; an unavailable input format must fail back to typing without crashing.
- Lifecycle: backgrounding or an audio interruption stops dictation; returning allows a fresh recording.
- Haptics: selection, reveal, and completion feel distinct; rapid card motion does not buzz continuously; disabling Sound & Haptics silences them.
- Manual wash: cards stay under the finger, remain centered, and require actual movement before release completes.
- Auto Wash: completes in roughly two seconds and advances through gather, cut, and post-cut shuffle without another tap.
- Reduced motion: enable iOS Reduce Motion while Hint's setting is off, then test the inverse. Each must skip prolonged motion and advance Auto Wash through the arc promptly. Change the device setting while the room is open and confirm the new preference takes effect.
- Arc: all 78 logical cards remain present; compact and expanded numbering/order match; far-right cards stay behind earlier cards.
- Card detail: artwork opens on tap, supports tap/pinch zoom, and has no cursor-hover movement or persistent zoom buttons. The small detail hint is dismissible and does not reappear during the same session.
- Recovery: background, foreground, refresh, and forced termination return to the nearest stable stage without reconstructing a partial animation.
- Keyboard: question and follow-up composers remain above the software keyboard and safe area.
- Share receipt: the native share sheet opens with a PNG; the question is absent by default and present only after opt-in; chat is never included; the QR opens the configured download page.
- Share cancellation: cancelling the share sheet returns to the reading without an error or leaked temporary file.
- History: restored artwork, card order, orientations, room background, interpretation, and follow-up chat exactly match the saved reading.
- Storage failure: simulate a failed reading save, verify the warning and receipt export, then free storage and retry. Confirm the same reading, full answer, and conversation restore after termination. An unsaved in-memory draft cannot be promised to survive forced termination.
- Recovery fallback: with an older durable session present, force its next write to fail. Continue the question or ritual, refresh, and confirm the newer fallback state opens. Restore storage and confirm it migrates without changing cards or room design.
- Follow-up request: stall the connection and verify the composer becomes available with a local reply after the deadline. Leave during a pending reply, resume History, and confirm a late result cannot overwrite new messages.
- Chinese keyboard: confirming a composed character must not send a follow-up. A deliberate send action sends once; typing remains available after a timeout.
- Interpretation recovery: terminate the app while generation is pending and after an offline fallback. Both restore the saved answer with an explicit Retry action; there is no silent new request. Retry preserves the reading identity, cards, room, and chat, and its completed result survives another termination.
- Repetition: complete five consecutive rituals without sustained animation hitching, layer inversion, duplicate navigation, or increasing delay.

## Evidence Record

Record the commit SHA, Xcode version, iOS version, simulator/device model, selected room design, selected card face/back, spread sizes tested, and any captured crash or console logs. Native validation is complete only when every item above passes on a physical iPhone and both simulator sizes.
