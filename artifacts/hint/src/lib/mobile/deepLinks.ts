import { isNativeShell } from "./runtime";
import { parseHintUniversalLink } from "../publicUrls";

export async function configureNativeDeepLinks(): Promise<() => Promise<void>> {
  if (!isNativeShell()) return async () => undefined;
  const { App } = await import("@capacitor/app");
  let active = true;
  let warmInvitationReceived = false;
  const navigate = ({ url }: { url: string }) => {
    const route = parseHintUniversalLink(url);
    if (!active || !route) return;
    const destination = `${import.meta.env.BASE_URL.replace(/\/$/, "")}${route}`;
    if (window.location.pathname === destination) return;
    window.history.pushState(null, "", destination);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  const listener = await App.addListener("appUrlOpen", event => {
    if (!active || !parseHintUniversalLink(event.url)) return;
    warmInvitationReceived = true;
    navigate(event);
  });
  try {
    const launch = await App.getLaunchUrl();
    if (launch && !warmInvitationReceived) navigate(launch);
  } catch {
    // Warm links still work if only cold-launch lookup is unavailable.
  }
  return async () => { active = false; await listener.remove(); };
}
