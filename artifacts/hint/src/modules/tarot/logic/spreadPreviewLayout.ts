export type SpreadPoint = { x: number; y: number };

/** Shared by the spread chooser and the printed receipt, in card/position order. */
const layouts: Readonly<Record<string, readonly SpreadPoint[]>> = {
  single: [{ x: 50, y: 50 }],
  three: [{ x: 24, y: 50 }, { x: 50, y: 50 }, { x: 76, y: 50 }],
  relationship: [{ x: 19.32, y: 65.34 }, { x: 80.68, y: 65.34 }, { x: 50, y: 34.66 }],
  futureLover: [
    { x: 14, y: 28 }, { x: 26, y: 38 }, { x: 38, y: 52 }, { x: 50, y: 66 },
    { x: 62, y: 52 }, { x: 74, y: 38 }, { x: 86, y: 28 },
  ],
  peachBlossom: [
    { x: 28, y: 30 }, { x: 72, y: 30 }, { x: 28, y: 66 }, { x: 72, y: 66 }, { x: 50, y: 48 },
  ],
  trueHeart: [
    { x: 28, y: 30 }, { x: 72, y: 30 }, { x: 28, y: 66 }, { x: 72, y: 66 }, { x: 50, y: 48 },
  ],
  reconciliation: [
    { x: 34, y: 26 }, { x: 66, y: 26 }, { x: 78, y: 48 }, { x: 66, y: 70 },
    { x: 50, y: 78 }, { x: 34, y: 70 }, { x: 22, y: 48 },
  ],
  loveTree: [
    { x: 50, y: 80 }, { x: 50, y: 58 }, { x: 28, y: 54 }, { x: 72, y: 54 },
    { x: 38, y: 34 }, { x: 62, y: 34 }, { x: 50, y: 18 },
  ],
  xRelationship: [
    { x: 24, y: 26 }, { x: 38, y: 40 }, { x: 50, y: 54 }, { x: 62, y: 40 },
    { x: 76, y: 26 }, { x: 62, y: 68 }, { x: 50, y: 80 }, { x: 38, y: 68 }, { x: 24, y: 80 },
  ],
};

export function getNamedSpreadLayout(id: string | undefined): readonly SpreadPoint[] | undefined {
  return id && Object.hasOwn(layouts, id) ? layouts[id] : undefined;
}

export function getSpreadPreviewLayout(spread: { id: string; cardCount: number; layout: readonly SpreadPoint[] }) {
  const named = getNamedSpreadLayout(spread.id);
  if (named) return named;
  const points = spread.layout.slice(0, spread.cardCount);
  if (points.length <= 1) return [{ x: 50, y: 50 }];
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const scale = Math.min(1.18, 68 / Math.max(1, maxX - minX), 56 / Math.max(1, maxY - minY));
  return points.map(point => ({
    x: 50 + (point.x - (minX + maxX) / 2) * scale,
    y: 50 + (point.y - (minY + maxY) / 2) * scale,
  }));
}
