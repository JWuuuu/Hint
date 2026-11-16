import { getHintPreferences, HINT_PREFERENCES_UPDATED_EVENT } from "./preferences";
import { isNativeShell } from "./mobile/runtime";
import { addNativeAppStateListener } from "./mobile/appLifecycle";

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
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

let lastHapticAt = -Infinity;
let lastDeliveredAt = -Infinity;
let latestRequest = 0;
const MIN_HAPTIC_INTERVAL_MS = 46;
const MAX_HAPTIC_DELAY_MS = 150;
let nativeHaptics: Promise<typeof import("@capacitor/haptics")> | undefined;
let lifecycleReady: Promise<void> | undefined;
let nativeActive = true;
let pageHidden = false;
let webVibrationStarted = false;
let disposed = false;
const removeLifecycleListeners: Array<() => void> = [];

function interruptFeedback() {
  ++latestRequest;
  if (!webVibrationStarted) return;
  webVibrationStarted = false;
  try { if (canVibrate()) navigator.vibrate(0); } catch { /* Optional feedback. */ }
}

function observeFeedbackLifecycle() {
  if (lifecycleReady) return;
  const visibility = () => { if (document.visibilityState === "hidden") interruptFeedback(); };
  const preferences = () => { if (!getHintPreferences().soundAndHaptics) interruptFeedback(); };
  const hide = () => { pageHidden = true; interruptFeedback(); };
  const show = () => { pageHidden = false; };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", visibility);
    removeLifecycleListeners.push(() => document.removeEventListener("visibilitychange", visibility));
  }
  if (typeof window !== "undefined") {
    window.addEventListener(HINT_PREFERENCES_UPDATED_EVENT, preferences);
    window.addEventListener("storage", preferences);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    removeLifecycleListeners.push(() => {
      window.removeEventListener(HINT_PREFERENCES_UPDATED_EVENT, preferences);
      window.removeEventListener("storage", preferences);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    });
  }
  if (isNativeShell()) {
    const registration = addNativeAppStateListener(active => {
      if (disposed) return;
      nativeActive = active;
      if (!active) interruptFeedback();
    }, { emitCurrentState: true }).then(remove => {
      if (disposed) void remove();
      else removeLifecycleListeners.push(() => { void remove(); });
    }).catch(() => undefined);
    // A broken optional App bridge cannot hold every future gesture forever.
    // Visibility/preferences still gate fallback; any native event wins immediately.
    lifecycleReady = new Promise(resolve => {
      const timeout = setTimeout(resolve, 100);
      void registration.then(() => { clearTimeout(timeout); resolve(); });
    });
  } else lifecycleReady = Promise.resolve();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    interruptFeedback();
    removeLifecycleListeners.splice(0).forEach(remove => remove());
  });
}

function loadNativeHaptics() {
  nativeHaptics ??= import("@capacitor/haptics").catch((error: unknown) => {
    nativeHaptics = undefined;
    throw error;
  });
  return nativeHaptics;
}

function hapticsEnabled() {
  return nativeActive && !pageHidden && getHintPreferences().soundAndHaptics &&
    (typeof document === "undefined" || document.visibilityState !== "hidden");
}

function tryWebHaptic(intent: FeedbackIntent) {
  if (!canVibrate() || !hapticsEnabled()) return;
  try {
    webVibrationStarted = navigator.vibrate(HAPTIC_PATTERNS[intent]) !== false;
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
    const [, { Haptics, ImpactStyle, NotificationType }] = await Promise.all([lifecycleReady, loadNativeHaptics()]);
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
  observeFeedbackLifecycle();
  if (!hapticsEnabled()) {
    ++latestRequest;
    return;
  }

  const now = Date.now();
  if (now - lastHapticAt < MIN_HAPTIC_INTERVAL_MS) return;
  lastHapticAt = now;
  // A throttled input leaves the first eligible intent intact, as on the web.
  // Only an accepted input supersedes pending work; interruptions still cancel it.
  const requestId = ++latestRequest;

  if (isNativeShell()) {
    void triggerNativeHaptic(intent, requestId, now);
    return;
  }

  tryWebHaptic(intent);
}

export function triggerFeedback(intent: FeedbackIntent = "tap") {
  triggerHaptic(intent);
}
