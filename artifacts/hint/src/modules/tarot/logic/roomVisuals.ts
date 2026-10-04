import type { RoomBackgroundId } from "../../hold/useHoldFlow";

export function getTarotRoomSurfaceBackground(
  backgroundId: RoomBackgroundId | string | undefined,
) {
  if (backgroundId === "dawn") {
    return "radial-gradient(ellipse at 65% 24%, rgba(237,218,190,0.34), transparent 52%), linear-gradient(180deg, #faf6ef 0%, #f4ece4 50%, #eee9e2 100%)";
  }
  if (backgroundId === "sea") {
    return "radial-gradient(ellipse at 62% 24%, rgba(203,221,215,0.34), transparent 52%), linear-gradient(180deg, #f8f7f1 0%, #edf1eb 48%, #e9e5ed 100%)";
  }
  return "radial-gradient(ellipse at 68% 24%, rgba(230,210,219,0.34), transparent 52%), linear-gradient(180deg, #faf6f0 0%, #f2e9eb 48%, #e9e2ee 100%)";
}

export function getTarotRoomStarClassName(
  backgroundId: RoomBackgroundId | string | undefined,
) {
  if (backgroundId === "sea") {
    return "opacity-34 [background-image:radial-gradient(circle_at_18%_24%,rgba(235,255,246,0.65)_0_1px,transparent_1px),radial-gradient(circle_at_78%_16%,rgba(244,196,214,0.70)_0_1px,transparent_1px),radial-gradient(circle_at_68%_76%,rgba(103,218,209,0.62)_0_1px,transparent_1px)] [background-size:132px_148px]";
  }
  if (backgroundId === "dawn") {
    return "opacity-28 [background-image:radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.84)_0_1px,transparent_1px),radial-gradient(circle_at_78%_16%,rgba(187,146,68,0.62)_0_1px,transparent_1px)] [background-size:142px_152px]";
  }
  return "opacity-44 [background-image:radial-gradient(circle_at_18%_24%,rgba(255,238,246,0.86)_0_1px,transparent_1px),radial-gradient(circle_at_78%_16%,rgba(248,214,152,0.82)_0_1px,transparent_1px),radial-gradient(circle_at_68%_76%,rgba(219,199,255,0.66)_0_1px,transparent_1px)] [background-size:132px_148px]";
}
