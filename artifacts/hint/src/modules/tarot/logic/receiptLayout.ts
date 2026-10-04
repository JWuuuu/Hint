export function getTarotReceiptCardLayout(cardCount: number) {
  if (!Number.isInteger(cardCount) || cardCount < 1 || cardCount > 9) {
    throw new Error("A receipt needs between one and nine cards.");
  }
  const columns = Math.min(3, cardCount);
  const cellWidth = 220;
  const gap = 24;
  const cardWidth = cardCount <= 3 ? 170 : 144;
  const visibleWidth = columns * cellWidth + (columns - 1) * gap;
  return {
    cardCount,
    columns,
    rows: Math.ceil(cardCount / columns),
    cellWidth,
    cardWidth,
    cardHeight: Math.round(cardWidth * 1.58),
    gap,
    visibleWidth,
    startX: (900 - visibleWidth) / 2,
  };
}

const words = new Intl.Segmenter(undefined, { granularity: "word" });
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function wrapReceiptText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
) {
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) throw new Error("Invalid receipt text width.");
  const lines: string[] = [];
  for (const paragraph of text.trim().split(/\r?\n/)) {
    const normalized = paragraph.replace(/\s+/g, " ").trim();
    const tokens: string[] = [];
    for (const { segment } of words.segment(normalized)) {
      // Keep closing punctuation with its word when a line breaks.
      if (/^[.,;:!?，。；：！？、）》」』】…”’]+$/u.test(segment) && tokens.length) {
        tokens[tokens.length - 1] += segment;
      } else tokens.push(segment);
    }
    let line = "";
    for (const token of tokens) {
      if (!line && !token.trim()) continue;
      if (measure(`${line}${token}`.trimEnd()) <= maxWidth) {
        line += token;
        continue;
      }
      if (line.trim()) lines.push(line.trim());
      line = "";
      for (const { segment } of graphemes.segment(token.trimStart())) {
        if (measure(segment) > maxWidth) throw new Error("Receipt text cannot fit within the paper margins.");
        if (measure(line + segment) > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += segment;
      }
    }
    if (line.trim()) lines.push(line.trim());
    else if (!normalized) lines.push("");
  }
  return lines;
}

export function balanceReceiptTitle(text: string, maxWidth: number, measure: (text: string) => number) {
  const lines = wrapReceiptText(text, maxWidth, measure);
  if (lines.length <= 1) return lines;
  let low = Math.min(maxWidth, Math.max(...[...words.segment(text)].map(({ segment }) => measure(segment))));
  let high = maxWidth;
  while (high - low > 1) {
    const middle = (low + high) / 2;
    if (wrapReceiptText(text, middle, measure).length > lines.length) low = middle;
    else high = middle;
  }
  return wrapReceiptText(text, Math.ceil(high), measure);
}
