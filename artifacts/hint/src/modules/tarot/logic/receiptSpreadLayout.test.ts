import { expect, it } from "vitest";
import { getReceiptSpreadLayout } from "./receiptSpreadLayout";
import { getSpreadPreviewLayout, getNamedSpreadLayout } from "./spreadPreviewLayout";

const spreads = ["single", "three", "relationship", "futureLover", "peachBlossom", "reconciliation", "trueHeart", "loveTree", "xRelationship"];

it.each(spreads)("keeps %s's chooser geometry and fits all cards and numbers without overlap", id => {
  const expected = getNamedSpreadLayout(id)!;
  const preview = getSpreadPreviewLayout({ id, cardCount: expected.length, layout: [] });
  const receipt = getReceiptSpreadLayout(id, expected.length);
  const { points, cardWidth, cardHeight, numberBand } = receipt;
  expect(points).toHaveLength(preview.length);
  let commonScale: number | undefined;
  points.forEach((point, i) => {
    expect(point.x - cardWidth / 2).toBeGreaterThanOrEqual(49.99);
    expect(point.x + cardWidth / 2).toBeLessThanOrEqual(600.01);
    expect(point.y - numberBand).toBeGreaterThanOrEqual(0);
    expect(point.y + cardHeight).toBeLessThanOrEqual(receipt.height + .01);
    points.slice(i + 1).forEach((other, offset) => {
      const j = i + offset + 1;
      const dx = Math.abs(point.x - other.x), dy = Math.abs(point.y - other.y);
      expect(dx >= cardWidth + 13.99 || dy >= cardHeight + numberBand + 13.99).toBe(true);
      for (const axis of ["x", "y"] as const) {
        const expectedDelta = preview[j][axis] - preview[i][axis];
        const delta = other[axis] - point[axis];
        if (!expectedDelta) expect(delta).toBeCloseTo(0);
        else {
          const scale = delta / expectedDelta;
          expect(scale).toBeGreaterThan(0);
          if (commonScale === undefined) commonScale = scale;
          else expect(scale).toBeCloseTo(commonScale);
        }
      }
    });
  });
});

it("keeps unknown and incomplete older readings printable with a centered fallback", () => {
  for (let count = 1; count <= 9; count++) {
    const layout = getReceiptSpreadLayout("archived-spread", count);
    expect(layout.points).toHaveLength(count);
    expect((Math.min(...layout.points.map(p => p.x)) + Math.max(...layout.points.map(p => p.x))) / 2).toBe(325);
  }
  expect(getReceiptSpreadLayout("trueHeart", 3).points).toHaveLength(3);
  expect(getReceiptSpreadLayout("toString", 1).points).toHaveLength(1);
});

it.each([0, 10, 1.5])("rejects invalid card counts (%s)", count => {
  expect(() => getReceiptSpreadLayout("three", count)).toThrow("between one and nine");
});
