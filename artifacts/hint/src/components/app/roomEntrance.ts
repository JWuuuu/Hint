/** Room arrival moves the content itself; it never covers or delays navigation. */
export const ROOM_ENTRANCES = {
  tarot: { scale: 1.026, travel: 12, duration: 1300 },
  astrology: { scale: 1.022, travel: 8, duration: 1300 },
  "animal-tarot": { scale: 1.022, travel: 10, duration: 1200 },
  journal: { scale: 1.018, travel: 10, duration: 1200 },
  readings: { scale: 1.018, travel: 8, duration: 1200 },
  dream: { scale: 1.022, travel: 10, duration: 1300 },
  personalities: { scale: 1.022, travel: 8, duration: 1200 },
  compatibility: { scale: 1.022, travel: 8, duration: 1300 },
  collection: { scale: 1.02, travel: 10, duration: 1200 },
  ask: { scale: 1.018, travel: 10, duration: 1300 },
  daily: { scale: 1.02, travel: 8, duration: 1200 },
  profile: { scale: 1.018, travel: 8, duration: 1200 },
  rooms: { scale: 1.018, travel: 8, duration: 1200 },
} as const;
export type EntranceRoom = keyof typeof ROOM_ENTRANCES;
export type EntranceRect = { x: number; y: number; width: number; height: number };

export function entrancePath(location: string) {
  return location.split(/[?#]/, 1)[0]!.replace(/\/+$/, "") || "/";
}
export function entranceRoom(location: string): EntranceRoom | null {
  const path = entrancePath(location).replace(/^\/app(?=\/|$)/, "");
  const room = path.split("/")[1];
  return room && Object.hasOwn(ROOM_ENTRANCES, room) ? room as EntranceRoom : null;
}
export function isEntranceOrigin(location: string) {
  return ["/", "/app"].includes(entrancePath(location)) || entranceRoom(location) !== null;
}

export const ENTRANCE_SETTLE_EASING = "cubic-bezier(.22,.61,.36,1)";

/** Clamp partially scrolled cards to the phone canvas, including embedded previews. */
export function entranceRect(source: DOMRect, bounds: DOMRect): EntranceRect | null {
  const x = Math.max(0, source.left - bounds.left);
  const y = Math.max(0, source.top - bounds.top);
  const width = Math.min(bounds.width, source.right - bounds.left) - x;
  const height = Math.min(bounds.height, source.bottom - bounds.top) - y;
  if (width < 1 || height < 1 || bounds.width < 1 || bounds.height < 1) return null;
  return { x, y, width, height };
}

export function entranceKeyframes(room: EntranceRoom, rect: EntranceRect, canvas: { width: number; height: number }, reduced: boolean): Keyframe[] {
  if (reduced) return [];
  const setting = ROOM_ENTRANCES[room];
  const horizontal = Math.max(0, Math.min(5, canvas.width * (setting.scale - 1) / 2 - .5));
  const vertical = Math.max(0, Math.min(setting.travel, canvas.height * (setting.scale - 1) / 2 - .5));
  const x = Math.max(-horizontal, Math.min(horizontal, ((rect.x + rect.width / 2) / Math.max(1, canvas.width) - .5) * 10));
  const y = Math.max(-vertical, Math.min(vertical, ((rect.y + rect.height / 2) / Math.max(1, canvas.height) - .5) * setting.travel * 2));
  // A slight overfill keeps the phone canvas covered while its actual contents
  // settle. Opacity stays unchanged: no veil, blur, clipping mask or blank beat.
  return [{ transform: `translate3d(${x}px, ${y}px, 0) scale(${setting.scale})` }, { transform: "translate3d(0, 0, 0) scale(1)" }];
}
