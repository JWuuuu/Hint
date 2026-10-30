import { createContext, useContext } from "react";
import { useLocation } from "wouter";
import type { HintSceneContext } from "../../../mascot-library/versions/v3.2/src/index";
import { HintGuideSlot } from "./HintGuide";

export const RoomComposition = createContext({ typing: false, keyboardOpen: false });
const rooms: Record<string, HintSceneContext["room"]> = {
  astrology: "astrology", compatibility: "astrology", collection: "collection",
  personalities: "personality", readings: "history", profile: "settings",
  journal: "journal", dream: "journal", daily: "daily", "animal-tarot": "tarot", rooms: "collection",
};

export function companionRoom(path: string) {
  return rooms[path.split(/[?#]/)[0].replace(/^\/app\/?/, "").split("/").filter(Boolean)[0] ?? ""];
}

/** A reserved place in navigation, so Hint never covers cards or the composer. */
export function RoomCompanion() {
  const [location] = useLocation();
  const composition = useContext(RoomComposition);
  const room = companionRoom(location);
  if (!room) return null;
  return <HintGuideSlot priority={35} context={{ room, phase: "idle", hasMessages: false,
    audioPlaying: false, ...composition }} className="-my-3 ml-auto h-20 w-20 shrink-0" />;
}
