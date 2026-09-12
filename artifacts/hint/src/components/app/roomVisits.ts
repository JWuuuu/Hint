import { getAnonId } from "../../lib/identity";

const closedInThisPage = new Map<string, boolean>();
const visitKey = (room: string) => `hint_room_visit_v1:${encodeURIComponent(getAnonId())}:${room}`;

/** Visit markers belong to this tab. They never erase another tab's draft. */
export function roomVisitWasClosed(room: string): boolean {
  const key = visitKey(room);
  if (closedInThisPage.has(key)) return closedInThisPage.get(key)!;
  try { return sessionStorage.getItem(key) === "closed"; } catch { return false; }
}

export function markRoomVisitStarted(room: string) {
  const key = visitKey(room);
  closedInThisPage.set(key, false);
  try { sessionStorage.setItem(key, "open"); } catch { /* The current page still knows its visit. */ }
}

export function markRoomVisitClosed(room: string) {
  const key = visitKey(room);
  closedInThisPage.set(key, true);
  try { sessionStorage.setItem(key, "closed"); } catch { /* Do not erase durable drafts as a fallback. */ }
}

export function canonicalRoom(path: string, base = import.meta.env.BASE_URL): string | null {
  let pathname = path.split(/[?#]/, 1)[0]!.replace(/\/+$/, "") || "/";
  const prefix = base.replace(/\/$/, "");
  if (prefix && pathname.startsWith(`${prefix}/`)) pathname = pathname.slice(prefix.length);
  if (!pathname.startsWith("/app/") && pathname !== "/app") {
    const legacy = pathname.split("/")[1];
    if (!["tarot", "ask", "rooms", "readings", "login", "signup", "me", "astrology", "compatibility", "dream", "journal", "daily-pull", "daily", "animal-tarot", "sky-deck", "collection", "profile", "settings", "personalities"].includes(legacy ?? "")) return null;
    pathname = `/app${pathname}`;
  }
  const room = pathname.split("/")[2];
  if (!room) return null;
  return ({ me: "profile", settings: "profile", "daily-pull": "daily", "sky-deck": "daily", signup: "login" } as Record<string, string>)[room] ?? room;
}
