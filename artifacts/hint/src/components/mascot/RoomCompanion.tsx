import { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import type { HintSceneContext } from "../../../mascot-library/versions/v3.2/src/index";
import { HintGuideSlot, useHintGuideEnabled } from "./HintGuide";

export const RoomComposition = createContext({ typing: false, keyboardOpen: false });
/** The element a screen provides for Hint's shared corner; undefined outside such a screen. */
export const HintCornerLayer = createContext<HTMLElement | null | undefined>(undefined);
const rooms: Record<string, HintSceneContext["room"]> = {
  astrology: "astrology", compatibility: "astrology", collection: "collection",
  personalities: "personality", readings: "history", profile: "settings",
  journal: "journal", dream: "journal", daily: "daily", "animal-tarot": "tarot", rooms: "collection",
};
const reserved = "-my-3 ml-auto h-20 w-20 shrink-0";

export function companionRoom(path: string) {
  return rooms[path.split(/[?#]/)[0].replace(/^\/app\/?/, "").split("/").filter(Boolean)[0] ?? ""];
}

/** The same box on every header page: 80px, top right, measured from the screen. */
export function HintCorner({ context, priority = 35 }: { context: HintSceneContext; priority?: number }) {
  return <HintGuideSlot priority={priority} context={context} className="hint-guide-corner" />;
}

/** A reserved place in navigation, so Hint never covers cards or the composer. */
export function RoomCompanion() {
  const [location] = useLocation();
  const composition = useContext(RoomComposition);
  const layer = useContext(HintCornerLayer);
  const enabled = useHintGuideEnabled();
  const room = companionRoom(location);
  if (!room) return null;
  const context: HintSceneContext = { room, phase: "idle", hasMessages: false, audioPlaying: false, ...composition };
  if (layer === undefined) return <HintGuideSlot priority={35} context={context} className={reserved} />;
  if (!enabled) return null;
  // Hint stands in the screen's corner; this row still keeps the room, so a
  // long label wraps beside the companion instead of running underneath.
  return <>
    <span aria-hidden="true" className={reserved} data-hint-guide-reserve />
    {layer && createPortal(<HintCorner context={context} />, layer)}
  </>;
}
