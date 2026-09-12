export type PickWheelStageSize = {
  width: number;
  height: number;
};

export type PickWheelGeometry = {
  centerX: number;
  centerY: number;
  radius: number;
  startAngle: number;
};

export type PickWheelLayout = {
  x: number;
  y: number;
  rotate: number;
  zIndex: number;
  angle: number;
};

export const TAROT_PHONE_FRAME_MAX_WIDTH = 440;
export const PICK_WHEEL_CARD_W = 84;
export const PICK_WHEEL_CARD_H = 134;
export const PICK_WHEEL_CARD_W_ZOOM = 124;
export const PICK_WHEEL_CARD_H_ZOOM = 198;
export const PICK_WHEEL_DRAG_SENSITIVITY = 0.0048;
export const PICK_WHEEL_STEP_SCALE = 0.74;

export function pickWheelStep(total: number) {
  return ((Math.PI * 2) / Math.max(total, 1)) * PICK_WHEEL_STEP_SCALE;
}

export function positiveModulo(value: number, total: number) {
  return ((value % total) + total) % total;
}

export function wheelDisplayNumber(index: number, total: number) {
  return positiveModulo(index, total) + 1;
}

export function getTarotPhoneStageSize(): PickWheelStageSize {
  if (typeof window === "undefined") return { width: 390, height: 844 };
  return {
    width: Math.min(window.innerWidth, TAROT_PHONE_FRAME_MAX_WIDTH),
    height: window.innerHeight,
  };
}

// This is the legacy lower-right wheel. Expanded mode changes card size only.
export function getPickWheelGeometry(
  size: PickWheelStageSize,
  _zoomed = false,
  reservedTop = 0,
): PickWheelGeometry {
  const shorter = Math.min(size.width, size.height);
  const baseRadius = shorter * 0.95;
  return {
    centerX: size.width,
    // Card anchors sit at their bottom edge. Reserve the entire rotated card,
    // its lifted state and number, rather than only keeping the arc line clear.
    centerY: Math.max(size.height + baseRadius * 0.43, reservedTop + baseRadius + Math.hypot(PICK_WHEEL_CARD_H + 38, PICK_WHEEL_CARD_W / 2)),
    radius: baseRadius,
    startAngle: -Math.PI * 0.86,
  };
}

export function getPickWheelLayout(
  index: number,
  rotation: number,
  total: number,
  geometry: PickWheelGeometry,
): PickWheelLayout {
  const angle = geometry.startAngle + rotation + index * pickWheelStep(total);
  const x = geometry.centerX + Math.cos(angle) * geometry.radius;
  const y = geometry.centerY + Math.sin(angle) * geometry.radius;
  return {
    x,
    y,
    rotate: angle + Math.PI / 2,
    // The fan is stacked from left to right: every card toward the right edge
    // stays behind its left-hand neighbor, including while the wheel rotates.
    zIndex: 100_000 - index,
    angle,
  };
}
