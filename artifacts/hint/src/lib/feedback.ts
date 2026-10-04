import { getHintPreferences } from "./preferences";
import { isNativeShell } from "./mobile/runtime";

export type FeedbackIntent =
  | "soft"
  | "tap"
  | "select"
  | "reveal"
  | "success"
  | "complete"
  | "warning";

const HAPTIC_PATTERNS: Record<FeedbackIntent, number | number[]> = {
  soft: 5,
  tap: 8,
  select: [8, 18, 10],
  reveal: [10, 24, 18, 40, 26],
  success: [12, 28, 30],
  complete: [12, 20, 12, 40, 28],
  warning: [24, 40, 24],
};

function canVibrate() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

let lastHapticAt = -Infinity;
let lastDeliveredAt = -Infinity;
let latestRequest = 0;
const MIN_HAPTIC_INTERVAL_MS = 46;
const MAX_HAPTIC_DELAY_MS = 150;
let nativeHaptics: Promise<typeof import("@capacitor/haptics")> | undefined;

function loadNativeHaptics() {
  nativeHaptics ??= import("@capacitor/haptics").catch((error: unknown) => {
    nativeHaptics = undefined;
    throw error;
  });
  return nativeHaptics;
}

function hapticsEnabled() {
  return getHintPreferences().soundAndHaptics &&
    (typeof document === "undefined" || document.visibilityState !== "hidden");
}

function tryWebHaptic(intent: FeedbackIntent) {
  if (!canVibrate() || !hapticsEnabled()) return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[intent]);
  } catch {
    // Feedback is optional on platforms that reject vibration.
  }
}

async function triggerNativeHaptic(intent: FeedbackIntent, requestId: number, requestedAt: number) {
  const isCurrent = () => {
    const age = Date.now() - requestedAt;
    return requestId === latestRequest && age >= 0 && age <= MAX_HAPTIC_DELAY_MS && hapticsEnabled();
  };
  try {
    const { Haptics, ImpactStyle, NotificationType } = await loadNativeHaptics();
    // A cold bridge import must not replay a backlog of finger movements.
    if (!isCurrent()) return;
    const now = Date.now();
    if (now - lastDeliveredAt < MIN_HAPTIC_INTERVAL_MS) return;
    lastDeliveredAt = now;
    if (intent === "success" || intent === "complete") {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    }
    if (intent === "warning") {
      await Haptics.notification({ type: NotificationType.Warning });
      return;
    }
    const style =
      intent === "reveal"
        ? ImpactStyle.Heavy
        : intent === "select"
          ? ImpactStyle.Medium
          : ImpactStyle.Light;
    await Haptics.impact({ style });
  } catch {
    if (isCurrent()) tryWebHaptic(intent);
  }
}

export function triggerHaptic(intent: FeedbackIntent = "tap") {
  const requestId = ++latestRequest;
  if (!hapticsEnabled()) return;

  const now = Date.now();
  if (now - lastHapticAt < MIN_HAPTIC_INTERVAL_MS) return;
  lastHapticAt = now;

  if (isNativeShell()) {
    void triggerNativeHaptic(intent, requestId, now);
    return;
  }

  tryWebHaptic(intent);
}

export function triggerFeedback(intent: FeedbackIntent = "tap") {
  triggerHaptic(intent);
}
