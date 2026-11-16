import type { TarotReceiptModel } from "../tarot/logic/shareReceipt";
import type { DailyScoreKey } from "../home/types/home.types";
import { balanceReceiptTitle, wrapReceiptText } from "../tarot/logic/receiptLayout";
import { receiptText } from "./receiptStrings";

export type ReceiptMeasure = (text: string, size: number, weight: number) => number;
export type ReceiptArtworkOptions = { downloadFooter?: boolean };
const palettes = {
  dark: { paper: "#efdee4", ink: "#302635", title: "#2a1836", rose: "#81628f", line: "#b79baa", track: "#d9c1d0", bar: "#8d6c9c" },
  bright: { paper: "#fffaf5", ink: "#783b4e", title: "#943750", rose: "#e687a2", line: "#efbac7", track: "#fbe5e9", bar: "#ea94ac" },
};
const ROLL_LEADER_HEIGHT = 144;
const TOP_INSET = 38;
export const RECEIPT_LEADER_RATIO = ROLL_LEADER_HEIGHT / 650;

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

export function artworkParts(palette: typeof palettes.dark) {
function star(x: number, y: number, size = 15, outline = false) {
  return `<path d="M ${x} ${y - size} Q ${x + size * .2} ${y - size * .2} ${x + size} ${y} Q ${x + size * .2} ${y + size * .2} ${x} ${y + size} Q ${x - size * .2} ${y + size * .2} ${x - size} ${y} Q ${x - size * .2} ${y - size * .2} ${x} ${y - size} Z" fill="${outline ? "none" : palette.rose}" stroke="${palette.rose}" stroke-width="${outline ? 2.5 : 0}"/>`;
}

function divider(x1: number, x2: number, y: number, ornament = false) {
  const middle = (x1 + x2) / 2;
  const line = (start: number, end: number) => `<path d="M ${start} ${y} H ${end}" fill="none" stroke="${palette.line}" stroke-width="1.6" stroke-dasharray="3 6" stroke-linecap="round"/>`;
  return ornament ? line(x1, middle - 24) + line(middle + 24, x2) + star(middle, y, 15) : line(x1, x2);
}

/** Fine serif lettering stays identical on the live roll and exported image. */
function hintWordmark() {
  return `<g transform="translate(256 34)" fill="${palette.rose}" role="img" aria-label="HINT"><title>HINT</title>
    <path d="M0 0H13V1.2H9V16.5H25V1.2H21V0H34V1.2H30V33.8H34V35H21V33.8H25V18H9V33.8H13V35H0V33.8H4V1.2H0Z"/>
    <path transform="translate(41 0)" d="M0 0H18V1.2H11.5V33.8H18V35H0V33.8H6.5V1.2H0Z"/>
    <path transform="translate(66 0)" d="M0 35V33.8H4V1.2H0V0H10L31 27.5V1.2H27V0H37V1.2H33V35H31.6L6 2V33.8H10V35Z"/>
    <path transform="translate(110 0)" d="M0 0H28L28.7 8H27.4C26.5 2.7 24.7 1.2 20.4 1.2H17V33.8H22V35H6V33.8H11V1.2H7.6C3.3 1.2 1.5 2.7 .6 8H-.7Z"/>
  </g>`;
}

/** Small native vector ornaments remain crisp in the phone preview and PNG. */
function scoreIcon(key: DailyScoreKey, x: number, y: number) {
  const paths: Record<DailyScoreKey, string> = {
    love: '<path d="M24 43 5 25C-7 10 13-3 24 10 35-3 55 10 43 25Z"/>',
    wealth: '<circle cx="24" cy="24" r="12"/><path d="M24 1v6m0 34v6M1 24h6m34 0h6M8 8l4 4m24 24 4 4M8 40l4-4m24-24 4-4" fill="none" stroke="currentColor" stroke-width="2"/>',
    career: `<path d="M17 10V6q0-3 3-3h8q3 0 3 3v4" fill="none" stroke="currentColor" stroke-width="3"/><rect x="2" y="11" width="44" height="31" rx="4"/><path d="M2 25h44" stroke="${palette.paper}" stroke-width="2"/><rect x="21" y="22" width="6" height="7" rx="1" fill="none" stroke="${palette.paper}" stroke-width="2"/>`,
    study: `<path d="M24 9Q13 1 5 7v32q10-5 19 2 9-7 19-2V7Q35 1 24 9Z"/><path d="M24 9v32M1 10v34q13-4 23 1 10-5 23-1V10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M24 10v28" stroke="${palette.paper}" stroke-width="2"/>`,
    people: '<circle cx="24" cy="12" r="8"/><circle cx="8" cy="14" r="6"/><circle cx="40" cy="14" r="6"/><path d="M13 42V30a11 11 0 0 1 22 0v12ZM1 40V29q0-10 11-8-4 4-3 19ZM47 40V29q0-10-11-8 4 4 3 19Z"/>',
  };
  return `<g transform="translate(${x} ${y}) scale(.86)" fill="${palette.rose}" color="${palette.rose}" aria-hidden="true">${paths[key]}</g>`;
}

/** Export-only signature and a blank space reserved for the app's QR code. */
function downloadFooter(message: string, top: number, measure: ReceiptMeasure) {
  const lines = balanceReceiptTitle(message, 330, line => measure(line, 40, 400));
  const lineHeight = 46;
  const messageHeight = lines.length * lineHeight;
  const panelHeight = Math.max(224, messageHeight + 92);
  const messageY = (panelHeight - 34 - messageHeight) / 2 + 34;
  const qrY = (panelHeight - 184) / 2;
  const svg = `<g data-receipt-download-footer="true" transform="translate(0 ${top})">
    <text x="226" y="${messageY}" fill="${palette.rose}" font-size="40" font-style="italic" text-anchor="middle">${lines.map((line, index) => `<tspan x="226" dy="${index ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join("")}</text>
    ${divider(110, 342, messageY + (lines.length - 1) * lineHeight + 34, true)}
    <rect data-receipt-qr-placeholder="true" x="444" y="${qrY}" width="150" height="150" rx="14" fill="#fff" fill-opacity=".55" stroke="${palette.rose}" stroke-width="1.8"/>
    <text x="519" y="${qrY + 181}" fill="${palette.ink}" font-size="23" text-anchor="middle">Download our app</text>
  </g>`;
  return { svg, height: panelHeight + 34 };
}

return { star, divider, hintWordmark, scoreIcon, downloadFooter };
}

/** The same receipt artwork, with an optional footer for saved/shared images. */
export function buildDailyReceiptArtwork(model: TarotReceiptModel, measure: ReceiptMeasure, image = model.cards[0]?.image, attachedToRoll = false, options: ReceiptArtworkOptions = {}) {
  const palette = palettes[model.theme ?? "dark"];
  const { star, divider, hintWordmark, scoreIcon, downloadFooter } = artworkParts(palette);
  const card = model.cards[0];
  if (!card || !image) throw new Error("Receipt artwork unavailable");
  const width = 650;
  const content: string[] = [];
  const text = (value: string, x: number, y: number, size: number, options: { color?: string; weight?: number; align?: "middle" | "start"; maxWidth?: number; lineHeight?: number; className?: string } = {}) => {
    const { color = palette.ink, weight = 400, align = "middle", maxWidth = 550, lineHeight = size * 1.28, className = "" } = options;
    const lines = wrapReceiptText(value, maxWidth, line => measure(line, size, weight));
    content.push(`<text class="${className}" x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" text-anchor="${align}">${lines.map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(line)}</tspan>`).join("")}</text>`);
    return y + (lines.length - 1) * lineHeight;
  };

  content.push(divider(64, 177, 54), star(200, 54, 14), star(236, 54, 8), star(414, 54, 8), star(450, 54, 14), divider(474, 586, 54));
  content.push(hintWordmark());
  const titleBottom = text(model.title, 325, 145, 63, { color: palette.title, weight: 600, maxWidth: 480, lineHeight: 67 });
  const dateY = titleBottom + 51;
  text(model.date, 325, dateY, 30, { maxWidth: 480, className: "daily-receipt-date" });
  content.push(star(66, 126, 19, true), star(584, 126, 19, true), star(66, dateY - 11, 13, true), star(584, dateY - 11, 13, true));
  const heroY = dateY + 61;
  content.push(divider(42, 608, heroY - 27, true));

  const nameLines = wrapReceiptText(card.name, 253, value => measure(value, 41, 500));
  const insightLines = wrapReceiptText(model.insight, 254, value => measure(value, 31, 400));
  const readingHeight = nameLines.length * 47 + 38 + 65 + insightLines.length * 42 + 39;
  const heroHeight = Math.max(405, readingHeight);
  const imageY = heroY + (heroHeight - 405) / 2;
  content.push(`<image class="daily-receipt-card-art" href="${escapeXml(image)}" x="42" y="${imageY}" width="272" height="405" preserveAspectRatio="xMidYMid meet"${card.orientation === "reversed" ? ` transform="rotate(180 178 ${imageY + 202.5})"` : ""}><title>${escapeXml(card.name)}</title></image>`);
  content.push(`<rect x="42" y="${imageY}" width="272" height="405" rx="12" fill="none" stroke="#b68b6c" stroke-width="1.6"/>`);
  let readY = heroY + (heroHeight - readingHeight) / 2 + 39;
  readY = text(card.name, 477, readY, 41, { weight: 500, maxWidth: 253, lineHeight: 47 }) + 46;
  readY = text(receiptText(model.language ?? "en", card.orientation), 477, readY, 32, { color: palette.rose, maxWidth: 254 }) + 36;
  content.push(divider(347, 608, readY, true));
  readY = text(model.insight, 351, readY + 57, 31, { align: "start", maxWidth: 254, lineHeight: 42, className: "daily-receipt-insight" });
  content.push(divider(347, 608, readY + 40, true));

  let cursor = heroY + heroHeight + 43;
  for (const score of model.daily?.scores ?? []) {
    content.push(scoreIcon(score.key, 62, cursor - 17));
    const scoreLabelSize = Math.min(32, 111 / Math.max(1, measure(score.label, 32, 400)) * 32);
    text(score.label, 130, cursor + 13, scoreLabelSize, { align: "start", maxWidth: 118 });
    const amount = Math.max(0, Math.min(100, score.score));
    content.push(`<rect x="258" y="${cursor - 11}" width="275" height="26" rx="13" fill="${palette.track}"/><rect x="258" y="${cursor - 11}" width="${275 * amount / 100}" height="26" rx="13" fill="${palette.bar}"/>`);
    text(String(score.score), 575, cursor + 14, 32, { maxWidth: 62 });
    cursor += 60;
  }
  const lucky = model.daily?.lucky ?? [];
  if (lucky.length) {
    cursor += 1;
    content.push(divider(42, 608, cursor));
    const cells = [lucky.find(item => item.key === "color"), lucky.find(item => item.key === "number")].filter(item => item !== undefined);
    const cellWidth = 566 / cells.length;
    let bottom = cursor + 116;
    cells.forEach((item, index) => {
      const center = 42 + cellWidth * (index + .5);
      text(item.label, center, cursor + 44, 28, { maxWidth: cellWidth - 32 });
      if (item.key === "color") {
        const swatch = /^#[0-9a-f]{6}$/i.test(item.swatch ?? "") ? item.swatch : palette.rose;
        content.push(`<circle cx="${center - 101}" cy="${cursor + 84}" r="19" fill="${swatch}" stroke="${palette.line}" stroke-width=".6"/>`);
        bottom = Math.max(bottom, text(item.value, center - 68, cursor + 94, 28, { align: "start", maxWidth: cellWidth - 75, lineHeight: 34 }) + 27);
      } else bottom = Math.max(bottom, text(item.value, center, cursor + 96, 42, { color: palette.rose, maxWidth: cellWidth - 38, lineHeight: 48 }) + 26);
    });
    if (cells.length === 2) content.push(`<path d="M325 ${cursor + 13}V${bottom - 12}" stroke="${palette.line}" stroke-width="1.6" stroke-dasharray="3 6"/>`, star(325, (cursor + bottom) / 2, 14));
    cursor = bottom;
    content.push(divider(42, 608, cursor));
  } else {
    cursor += 8;
    content.push(divider(42, 608, cursor));
  }
  const footerTop = cursor + 12;
  let footerEnd: number;
  if (options.downloadFooter && !attachedToRoll) {
    const footer = downloadFooter(model.labels.footer, footerTop, measure);
    content.push(footer.svg);
    footerEnd = footerTop + footer.height;
  } else {
    const footerY = footerTop + ROLL_LEADER_HEIGHT * .4 + 14;
    // The invitation turns into this printed footer on the same exposed paper.
    content.push('<g data-receipt-footer="true" font-style="italic">');
    const footerBottom = text(model.labels.footer, 325, footerY, 42, { color: palette.rose, maxWidth: 520, lineHeight: 48 });
    content.push(star(38, footerY - 14, 12, true), star(612, footerY - 14, 12, true), '</g>');
    footerEnd = Math.max(footerTop + ROLL_LEADER_HEIGHT, footerBottom + 40);
  }
  const height = Math.ceil(TOP_INSET + footerEnd);
  if (height > 4096) throw new Error("This reading is too long for a single receipt image.");
  const tearY = height - 24;
  const zigzag = Array.from({ length: 24 }, (_, index) => `L${Math.round(648 - (index + 1) * 646 / 24)} ${index % 2 === 0 ? height - 3 : tearY}`).join(" ");
  // The on-machine sheet is continuous at the mouth; a shared image is a cut ticket.
  const paperPath = attachedToRoll
    ? `M2 -2H648V${tearY}${zigzag}L2 ${tearY}Z`
    : `M44 2H606Q648 2 648 44V88C628 90 628 116 648 118V${tearY}${zigzag}L2 ${tearY}V118C22 116 22 90 2 88V44Q2 2 44 2Z`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${model.title}, ${model.date}, ${card.name}`)}" style="font-family:Georgia,'Times New Roman',serif"><title>${escapeXml(`${model.title} — ${card.name}`)}</title><path d="${paperPath}" fill="${palette.paper}" stroke="${palette.line}" stroke-width="2"/><g transform="translate(0 ${TOP_INSET})">${content.join("")}</g></svg>`;
  return { svg, width, height };
}
