import type { TarotReceiptModel } from "../tarot/logic/shareReceipt";
import { wrapReceiptText } from "../tarot/logic/receiptLayout";
import { getReceiptSpreadLayout } from "../tarot/logic/receiptSpreadLayout";
import { artworkParts, escapeXml, RECEIPT_LEADER_RATIO, type ReceiptMeasure, type ReceiptArtworkOptions } from "./dailyReceiptArtwork";
import { receiptText } from "./receiptStrings";

/** The live roll and saved image use this same illustrated, variable-length ticket. */
export function buildTarotReceiptArtwork(
  model: TarotReceiptModel,
  measure: ReceiptMeasure,
  images = model.cards.map(card => card.image),
  attachedToRoll = false,
  options: ReceiptArtworkOptions = {},
) {
  const diagram = getReceiptSpreadLayout(model.spreadType, model.cards.length);
  const language = model.language ?? "en";
  const palette = model.theme === "dark"
    ? { paper: "#f1e1e5", ink: "#42313f", title: "#492439", rose: "#a16f91", line: "#c69cac", track: "", bar: "" }
    : { paper: "#fff0e7", ink: "#473b3b", title: "#681c37", rose: "#d58296", line: "#d7a1a8", track: "", bar: "" };
  const { star, divider, hintWordmark, downloadFooter } = artworkParts(palette);
  const width = 650;
  const inset = 24;
  const content: string[] = [];
  const text = (value: string, x: number, y: number, size: number, maxWidth: number, color = palette.ink, weight = 400, lineHeight = size * 1.2, attributes = "", anchor: "middle" | "start" = "middle") => {
    const lines = wrapReceiptText(value, maxWidth, line => measure(line, size, weight));
    content.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" ${attributes}>${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`);
    return y + (lines.length - 1) * lineHeight;
  };
  const moon = (x: number, y: number, size: number) => `<path d="M${x + size * .4} ${y - size}C${x - size * 1.2} ${y - size * .8} ${x - size * 1.2} ${y + size} ${x + size * .4} ${y + size}C${x - size * .3} ${y + size * .5} ${x - size * .3} ${y - size * .5} ${x + size * .4} ${y - size}Z" fill="#f0c4a6" stroke="${palette.rose}" stroke-width=".9"/>`;
  const sun = (x: number, y: number, size: number) => `<g stroke="${palette.rose}" stroke-width=".8" fill="none">${Array.from({ length: 16 }, (_, i) => {
    const a = i * Math.PI / 8;
    const r = i % 2 ? size * .65 : size;
    return `<path d="M${x + Math.sin(a) * 5} ${y + Math.cos(a) * 5}L${x + Math.sin(a) * r} ${y + Math.cos(a) * r}"/>`;
  }).join("")}</g>${star(x, y, size * .55)}`;
  const sprig = (x: number, y: number, scale = 1) => `<g transform="translate(${x} ${y}) scale(${scale})" stroke="${palette.rose}" stroke-width="1" fill="${palette.rose}" fill-opacity=".22"><path d="M0 32Q-5 0 1-24" fill="none"/>${[-18, -4, 10].map((dy, i) => `<path d="M0 ${dy + 12}Q${-18 + i * 2} ${dy + 2} -12 ${dy - 7}Q0 ${dy - 1} 0 ${dy + 12}ZM0 ${dy + 17}Q18 ${dy + 4} 12 ${dy - 4}Q0 ${dy + 4} 0 ${dy + 17}Z"/>`).join("")}<path d="M1-17Q-7-28 1-34Q8-27 1-17Z"/></g>`;

  content.push(divider(56, 176, 52), star(202, 52, 13), star(237, 52, 7), hintWordmark(), star(414, 52, 7), star(450, 52, 13), divider(475, 594, 52));
  const title = receiptText(language, "tarotReading");
  const titleBottom = text(title, 325, 132, 52, 426, palette.title, 600, 58);
  content.push(moon(83, 125, 27), star(52, 107, 9), star(111, 148, 7), sun(563, 123, 35), star(596, 151, 9));
  const dateY = titleBottom + 41;
  text(model.date, 325, dateY, 26, 478);
  let cursor = dateY + 44;
  content.push(divider(36, 614, cursor - 17, true));
  if (model.question) {
    cursor = text(`“${model.question}”`, 325, cursor + 28, 30, 532, palette.title, 400, 37) + 42;
  }
  const diagramTop = cursor + 12;
  const { cardWidth: artWidth, cardHeight: artHeight } = diagram;
  content.push('<g data-receipt-spread="true">');
  if (diagram.points.length > 1) {
    content.push(`<polyline points="${diagram.points.map(point => `${point.x},${diagramTop + point.y + artHeight / 2}`).join(" ")}" fill="none" stroke="${palette.line}" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="5 8"/>`);
  }
  diagram.points.forEach((point, index) => {
    const card = model.cards[index];
    const image = images[index];
    if (!image) throw new Error(`Receipt artwork unavailable: ${card.name}`);
    const artX = point.x - artWidth / 2;
    const artTop = diagramTop + point.y;
    content.push(`<g data-receipt-card="${index}">`);
    // The number belongs to the position, so it remains upright for reversed cards.
    text(String(index + 1), point.x, artTop - 12, 30, artWidth, palette.rose, 600, 36, 'data-card-text="number"');
    content.push(`<rect x="${artX - 2}" y="${artTop - 2}" width="${artWidth + 4}" height="${artHeight + 4}" rx="7" fill="#f9e4c7" stroke="#b79572" stroke-width="1.2"/><image href="${escapeXml(image)}" x="${artX}" y="${artTop}" width="${artWidth}" height="${artHeight}" preserveAspectRatio="xMidYMid meet"${card.orientation === "reversed" ? ` transform="rotate(180 ${point.x} ${artTop + artHeight / 2})"` : ""}><title>${escapeXml(card.name)}</title></image></g>`);
  });
  content.push('</g>');
  cursor = diagramTop + diagram.height + 32;
  content.push(divider(54, 596, cursor, true));

  const meaningsTop = cursor;
  // A separate, full-width list keeps each position's name and reflection legible.
  content.push('<g data-receipt-meanings="true">');
  model.cards.forEach((card, index) => {
    const rowTop = cursor + 38;
    content.push(`<g data-receipt-meaning="${index}">`);
    text(String(index + 1), 65, rowTop, 30, 40, palette.rose, 600, 36, 'data-card-text="meaning-number"');
    const positionBottom = text(card.position, 100, rowTop, 28, 490, palette.rose, 600, 34, 'data-card-text="position"', "start");
    const orientation = receiptText(language, card.orientation);
    const orientationWidth = measure(orientation, 24, 400);
    const nameWidth = Math.max(220, 490 - orientationWidth - 24);
    const nameTop = positionBottom + 37;
    const nameBottom = text(card.name, 100, nameTop, 34, nameWidth, palette.title, 500, 40, 'data-card-text="name"', "start");
    text(orientation, 100 + nameWidth + 24, nameBottom, 24, orientationWidth + 1, palette.rose, 400, 29, 'data-card-text="orientation"', "start");
    const meaningBottom = text(card.meaning ?? model.insight, 100, nameBottom + 39, 30, 490, palette.ink, 400, 36, 'data-card-text="meaning"', "start");
    cursor = meaningBottom + 26;
    content.push('</g>');
    if (index < model.cards.length - 1) content.push(divider(100, 590, cursor));
  });
  content.push('</g>');
  // Keep the original paper's delicate margins, away from the reading itself.
  for (const side of [27, 623]) {
    content.push(`<path d="M${side} ${diagramTop + 38}V${cursor - 14}" stroke="${palette.line}" stroke-width="1" stroke-dasharray="2 5"/>`);
    content.push(star(side, diagramTop + 68, 10), moon(side, diagramTop + diagram.height / 2, 12), sprig(side, meaningsTop - 62, .65));
    content.push(star(side, (meaningsTop + cursor) / 2, 10), sun(side, cursor - 28, 18));
  }
  if (model.personal) {
    content.push(divider(54, 596, cursor, true));
    cursor = text(model.labels.reading, 325, cursor + 36, 22, 532, palette.rose, 500) + 40;
    cursor = text(model.insight, 325, cursor, 30, 532, palette.ink, 400, 38, 'data-testid="receipt-insight"') + 36;
  }
  if (model.labels.originalText) cursor = text(model.labels.originalText, 325, cursor + 8, 15, 516, palette.rose, 400, 20) + 25;
  for (const detail of model.details ?? []) cursor = text(`${detail.label}: ${detail.value}`, 325, cursor + 12, 20, 516) + 24;
  content.push(divider(36, 614, cursor, true));
  const footerTop = cursor + 10;
  let footerEnd: number;
  if (options.downloadFooter && !attachedToRoll) {
    const footer = downloadFooter(model.labels.footer, footerTop, measure);
    content.push(footer.svg);
    footerEnd = footerTop + footer.height;
  } else {
    const leaderHeight = width * RECEIPT_LEADER_RATIO;
    const footerY = footerTop + leaderHeight * .4 + 14;
    content.push('<g data-receipt-footer="true" font-style="italic">');
    const footerBottom = text(model.labels.footer, 325, footerY, 28, 506, palette.rose, 400, 34);
    content.push(star(43, footerY - 9, 11), star(607, footerY - 9, 11), "</g>");
    footerEnd = Math.max(footerTop + leaderHeight, footerBottom + 40);
  }
  const height = Math.ceil(inset + footerEnd);
  if (height > 4096) throw new Error("This reading is too long for a single receipt image.");
  const tearY = height - 22;
  const zigzag = Array.from({ length: 24 }, (_, index) => `L${Math.round(648 - (index + 1) * 646 / 24)} ${index % 2 === 0 ? height - 3 : tearY}`).join(" ");
  const paperPath = attachedToRoll
    ? `M2 -2H648V${tearY}${zigzag}L2 ${tearY}Z`
    : `M44 2H606Q648 2 648 44V77C625 79 625 105 648 107V${tearY}${zigzag}L2 ${tearY}V107C25 105 25 79 2 77V44Q2 2 44 2Z`;
  // Keep the first path as the flat paper outline for the roll's instant preview.
  const description = [title, model.title, model.date, model.question, ...model.cards.map((card, index) => `${index + 1}. ${card.position}: ${card.name}, ${receiptText(language, card.orientation)}. ${card.meaning ?? model.insight}`), model.personal ? model.insight : undefined, model.labels.originalText, model.labels.footer].filter(Boolean).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(description)}" style="font-family:Georgia,'Times New Roman',serif"><title>${escapeXml(title)}</title><path d="${paperPath}" fill="${palette.paper}" stroke="${palette.line}" stroke-width="1.6"/><g transform="translate(0 ${inset})">${content.join("")}</g></svg>`;
  return { svg, width, height };
}
