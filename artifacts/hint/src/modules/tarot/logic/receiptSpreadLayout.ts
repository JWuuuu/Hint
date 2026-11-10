import { getTarotReceiptCardLayout } from "./receiptLayout";
import { getNamedSpreadLayout } from "./spreadPreviewLayout";

/** Fit the actual spread as one diagram, reserving space above every card for its number. */
export function getReceiptSpreadLayout(spreadType: string | undefined, cardCount: number) {
  const { columns, rows } = getTarotReceiptCardLayout(cardCount);
  const named = getNamedSpreadLayout(spreadType);
  // Older/imported readings can have an unknown spread or a partial card set.
  const points = named?.length === cardCount ? named : Array.from({ length: cardCount }, (_, index) => {
    const row = Math.floor(index / columns);
    const rowCount = Math.min(columns, cardCount - row * columns);
    return { x: 50 + (index % columns - (rowCount - 1) / 2) * 30, y: 50 + (row - (rows - 1) / 2) * 46 };
  });
  const minX = Math.min(...points.map(point => point.x));
  const maxX = Math.max(...points.map(point => point.x));
  const minY = Math.min(...points.map(point => point.y));
  const maxY = Math.max(...points.map(point => point.y));
  const spanX = maxX - minX, spanY = maxY - minY;
  const numberBand = 38;
  const maxHeight = cardCount <= 3 ? 410 : 560;
  const maxWidth = cardCount === 1 ? 230 : cardCount <= 3 ? 156 : cardCount <= 5 ? 132 : 100;
  const geometry = (cardWidth: number) => {
    const cardHeight = cardWidth * 1.48;
    const scale = Math.min(
      spanX ? (550 - cardWidth) / spanX : Infinity,
      spanY ? (maxHeight - cardHeight - numberBand) / spanY : Infinity,
    );
    return { cardWidth, cardHeight, scale: Number.isFinite(scale) ? scale : 1 };
  };
  const fits = (cardWidth: number) => {
    const { cardHeight, scale } = geometry(cardWidth);
    return points.every((point, index) => points.slice(index + 1).every(other =>
      Math.abs(point.x - other.x) * scale >= cardWidth + 14 ||
      Math.abs(point.y - other.y) * scale >= cardHeight + numberBand + 14,
    ));
  };
  let low = 12, high = maxWidth;
  while (high - low > .1) {
    const middle = (low + high) / 2;
    if (fits(middle)) low = middle;
    else high = middle;
  }
  const { cardWidth, cardHeight, scale } = geometry(fits(maxWidth) ? maxWidth : Math.floor(low));
  return {
    cardWidth, cardHeight, numberBand,
    height: spanY * scale + cardHeight + numberBand,
    points: points.map(point => ({
      x: 325 + (point.x - (minX + maxX) / 2) * scale,
      y: (point.y - minY) * scale + numberBand,
    })),
  };
}
