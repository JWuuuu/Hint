import { useSyncExternalStore } from "react";

export const ONBOARDING_COMPLETE_KEY = "hint_onboarding_complete_v3";
export const ONBOARDING_RESET_PARAM = "onboarding";
export const ONBOARDING_UPDATED_EVENT = "hint:onboarding-updated";

/** History events that can change `onboarding=reset` without changing the routed pathname. */
const LOCATION_EVENTS = ["popstate", "pushState", "replaceState", "hashchange"] as const;

export function onboardingIsComplete(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasOnboardingReset(search: string = typeof window === "undefined" ? "" : window.location.search): boolean {
  return new URLSearchParams(search).get(ONBOARDING_RESET_PARAM) === "reset";
}

/** Removes only the replay flag; unrelated query parameters and their order are preserved. */
export function withoutOnboardingReset(search: string): string {
  const params = new URLSearchParams(search);
  if (params.get(ONBOARDING_RESET_PARAM) !== "reset") return search;
  params.delete(ONBOARDING_RESET_PARAM);
  const next = params.toString();
  return next ? `?${next}` : "";
}

/** Persists completion and tells listeners in this tab (storage events only reach other tabs). */
export function markOnboardingComplete() {
  window.localStorage.setItem(ONBOARDING_COMPLETE_KEY, "1");
  window.dispatchEvent(new Event(ONBOARDING_UPDATED_EVENT));
}

export function onboardingOwnsScreen(): boolean {
  if (typeof window === "undefined") return false;
  return hasOnboardingReset() || !onboardingIsComplete();
}

function subscribe(onChange: () => void) {
  const events = [...LOCATION_EVENTS, "storage", ONBOARDING_UPDATED_EVENT];
  events.forEach((name) => window.addEventListener(name, onChange));
  return () => events.forEach((name) => window.removeEventListener(name, onChange));
}

/** Reactive `onboarding=reset`; wouter's location omits the query, so it cannot signal this. */
export function useOnboardingResetRequested(): boolean {
  return useSyncExternalStore(subscribe, () => hasOnboardingReset(), () => false);
}

/** Reactive form of `onboardingOwnsScreen` for chrome rendered outside the gate. */
export function useOnboardingOwnsScreen(): boolean {
  return useSyncExternalStore(subscribe, onboardingOwnsScreen, () => false);
}
