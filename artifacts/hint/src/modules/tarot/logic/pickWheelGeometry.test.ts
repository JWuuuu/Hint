import { describe, expect, it } from "vitest";
import {
  PICK_WHEEL_CARD_H_ZOOM,
  PICK_WHEEL_CARD_W_ZOOM,
  PICK_WHEEL_STEP_SCALE,
  PICK_WHEEL_CARD_H,
  PICK_WHEEL_CARD_W,
  getPickWheelGeometry,
  getPickWheelLayout,
  pickWheelStep,
} from "./pickWheelGeometry";

describe("legacy tarot pick wheel", () => {
  it.each([{ width: 375, height: 603 }, { width: 440, height: 833 }])("keeps the full rotating fan below the measured selected-card area on $width", size => {
    const reservedTop = 324;
    const geometry = getPickWheelGeometry(size, false, reservedTop);
    for (let index = 0; index < 78; index++) {
      const layout = getPickWheelLayout(index, 0.23, 78, geometry);
      // Bound the complete rotated face, armed lift and its number at every angle.
      const highest = layout.y - Math.hypot(PICK_WHEEL_CARD_H + 38, PICK_WHEEL_CARD_W / 2);
      expect(highest).toBeGreaterThanOrEqual(reservedTop);
    }
  });
  it("keeps the old lower-right arc fixed when expanded", () => {
    const size = { width: 440, height: 956 };
    const compact = getPickWheelGeometry(size, false);
    const expanded = getPickWheelGeometry(size, true);

    expect(expanded).toEqual(compact);
    expect(compact).toEqual({
      centerX: 440,
      centerY: 1135.74,
      radius: 418,
      startAngle: -Math.PI * 0.86,
    });
    expect(PICK_WHEEL_CARD_W_ZOOM).toBe(124);
    expect(PICK_WHEEL_CARD_H_ZOOM).toBe(198);
  });

  it("uses all 78 fixed slots and layers the fan from left to right", () => {
    const geometry = getPickWheelGeometry({ width: 440, height: 956 });
    const first = getPickWheelLayout(0, 0, 78, geometry);
    const next = getPickWheelLayout(1, 0, 78, geometry);

    expect(pickWheelStep(78)).toBeCloseTo((Math.PI * 2 / 78) * PICK_WHEEL_STEP_SCALE);
    expect(next.angle - first.angle).toBeCloseTo(pickWheelStep(78));
    expect(next.x).toBeGreaterThan(first.x);
    expect(next.zIndex).toBeLessThan(first.zIndex);
  });

  it("keeps every next card behind its neighbor at the right edge", () => {
    const geometry = getPickWheelGeometry({ width: 440, height: 956 });
    const card18 = getPickWheelLayout(17, 0, 78, geometry);
    const card19 = getPickWheelLayout(18, 0, 78, geometry);
    const card20 = getPickWheelLayout(19, 0, 78, geometry);
    const card21 = getPickWheelLayout(20, 0, 78, geometry);

    expect(card19.zIndex).toBeLessThan(card18.zIndex);
    expect(card20.zIndex).toBeLessThan(card19.zIndex);
    expect(card21.zIndex).toBeLessThan(card20.zIndex);
  });
});
