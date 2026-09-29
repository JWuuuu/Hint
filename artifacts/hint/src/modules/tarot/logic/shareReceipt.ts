import type { LocalTarotReading } from "../../readings/localTarotReadings";
import { getTarotCardImage } from "./cardImageMap";
import { getTarotReceiptInsight } from "./receiptPrivacy";
import { balanceReceiptTitle, getTarotReceiptCardLayout, wrapReceiptText } from "./receiptLayout";
import { hintDownloadUrl, validatePublicUrl } from "@/lib/publicUrls";
import { translateText } from "../../../lib/LocalizedText";
import type { HintLanguage } from "../../../lib/i18n";
import { receiptCardName, receiptPosition, receiptSpreadLabel, receiptOriginalTextLabel } from "./receiptCopy";

export { getTarotReceiptCardLayout } from "./receiptLayout";

export type TarotReceiptModel = {
  language?: HintLanguage;
  title: string;
  date: string;
  insight: string;
  question?: string;
  cards: Array<{
    name: string;
    position: string;
    orientation: "upright" | "reversed";
    image?: string;
  }>;
  downloadUrl?: string;
  details?: Array<{ label: string; value: string }>;
  labels: { brand: string; reading: string; footer: string; originalText?: string };
};

export function getHintDownloadUrl() {
  try { return validatePublicUrl(hintDownloadUrl()).href; }
  catch { return undefined; }
}

export function buildTarotReceiptModel(
  reading: LocalTarotReading,
  includeQuestion: boolean,
  downloadUrl = getHintDownloadUrl(),
  language: HintLanguage = "en",
): TarotReceiptModel {
  return {
    language,
    title: receiptSpreadLabel(reading.spreadType, language),
    date: new Date(reading.createdAt).toLocaleDateString(language, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    insight: getTarotReceiptInsight(reading.cards, reading.shortAnswer, includeQuestion),
    question: includeQuestion ? reading.question?.trim() || undefined : undefined,
    cards: reading.cards.map((card, index) => ({
      name: receiptCardName(card.cardId, index, language),
      position: receiptPosition(reading.spreadType, index, language),
      orientation: card.orientation,
      image: getTarotCardImage(
        card.cardId,
        reading.roomDesign?.cardArtId ?? reading.cardArtId ?? "original",
      ) ?? undefined,
    })),
    downloadUrl,
    labels: {
      brand: translateText("HINT TAROT", language), reading: translateText("YOUR READING", language),
      footer: translateText(downloadUrl ? "Open your own reading in Hint" : "A little letter from the universe.", language),
      originalText: receiptOriginalTextLabel(includeQuestion && Boolean(reading.shortAnswer.trim()), language),
    },
  };
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.lineTo(x + width - corner, y);
  context.quadraticCurveTo(x + width, y, x + width, y + corner);
  context.lineTo(x + width, y + height - corner);
  context.quadraticCurveTo(x + width, y + height, x + width - corner, y + height);
  context.lineTo(x + corner, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - corner);
  context.lineTo(x, y + corner);
  context.quadraticCurveTo(x, y, x + corner, y);
  context.closePath();
}

type ReceiptOperationOptions = { signal?: AbortSignal; language?: HintLanguage };

function requireActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Receipt cancelled", "AbortError");
}

function loadImage(src: string, signal?: AbortSignal, timeoutMs = 2_500) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    requireActive(signal);
    const image = new Image();
    let settled = false;
    const cancel = () => finish("abort");
    const finish = (result: "load" | "error" | "abort") => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", cancel);
      if (result === "load") resolve(image);
      else if (result === "abort") {
        image.src = "";
        reject(new DOMException("Receipt cancelled", "AbortError"));
      }
      else reject(new Error(`Receipt image did not load: ${src}`));
    };
    const timer = window.setTimeout(() => finish("error"), timeoutMs);
    image.onload = () => finish("load");
    image.onerror = () => finish("error");
    signal?.addEventListener("abort", cancel, { once: true });
    image.crossOrigin = "anonymous";
    image.src = src;
  });
}

async function createQrCanvas(text: string, size: number) {
  const canvas = document.createElement("canvas");
  const qr = await import("qrcode");
  const toCanvas = qr.toCanvas ?? (qr as unknown as { default?: typeof qr }).default?.toCanvas;
  if (!toCanvas) throw new Error("QR renderer unavailable");
  await toCanvas(canvas, text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#342940", light: "#fffaf5" },
  });
  return canvas;
}

export async function createTarotReceiptBlob(model: TarotReceiptModel, { signal }: ReceiptOperationOptions = {}) {
  requireActive(signal);
  const width = 900;
  const scale = 2;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");

  type TextBlock = { font: string; color: string; lines: string[]; x: number; y: number; lineHeight: number };
  const textBlocks: TextBlock[] = [];
  const addText = (text: string, font: string, color: string, y: number, lineHeight: number, maxWidth = 700, x = width / 2, balance = false) => {
    context.font = font;
    const lines = (balance ? balanceReceiptTitle : wrapReceiptText)(text, maxWidth, (value) => context.measureText(value).width);
    textBlocks.push({ font, color, lines, x, y, lineHeight });
    return y + lines.length * lineHeight;
  };
  let cursor = addText(model.labels.brand, "700 24px Arial", "#9c7891", 104, 32) + 24;
  cursor = addText(model.title, "500 56px Georgia", "#30263b", cursor, 64, 700, width / 2, true) + 16;
  cursor = addText(model.date, "500 22px Arial", "#827381", cursor, 30) + 48;
  if (model.question) {
    cursor = addText(`“${model.question}”`, "italic 28px Georgia", "#6f6070", cursor, 38) + 40;
  }

  const layout = getTarotReceiptCardLayout(model.cards.length);
  const { columns, cellWidth, cardWidth, cardHeight, gap } = layout;
  const cardPlacements: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < layout.rows; row++) {
    const rowCards = model.cards.slice(row * columns, (row + 1) * columns);
    const rowWidth = rowCards.length * cellWidth + (rowCards.length - 1) * gap;
    const startX = (width - rowWidth) / 2;
    let rowBottom = cursor + cardHeight;
    rowCards.forEach((card, column) => {
      const centerX = startX + column * (cellWidth + gap) + cellWidth / 2;
      cardPlacements.push({ x: centerX - cardWidth / 2, y: cursor });
      const labelBottom = addText(card.position.toUpperCase(), "600 15px Arial", "#8b6a82", cursor + cardHeight + 18, 21, cellWidth, centerX);
      const nameBottom = addText(card.name, "500 23px Georgia", "#342940", labelBottom + 7, 29, cellWidth, centerX);
      rowBottom = Math.max(rowBottom, nameBottom);
    });
    cursor = rowBottom + 36;
  }
  cursor = addText(model.labels.reading, "700 19px Arial", "#9c7891", cursor + 18, 26) + 20;
  if (model.labels.originalText) cursor = addText(model.labels.originalText, "500 18px Arial", "#827381", cursor, 26) + 12;
  cursor = addText(model.insight, "500 31px Georgia", "#3c3146", cursor, 42);
  for (const detail of model.details ?? []) {
    cursor = addText(`${detail.label}: ${detail.value}`, "500 23px Arial", "#6f6070", cursor + 16, 32);
  }
  const height = Math.max(1400, Math.ceil(cursor + 344));
  if (height > 4096) throw new Error("This reading is too long for a single receipt image.");
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#fff7f1");
  background.addColorStop(0.52, "#f8edf4");
  background.addColorStop(1, "#eee7f6");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(184,145,95,0.44)";
  context.lineWidth = 2;
  roundedRect(context, 54, 54, width - 108, height - 108, 42);
  context.stroke();

  const images = await Promise.all(
    model.cards.map((card) => {
      if (!card.image) throw new Error(`Receipt artwork unavailable: ${card.name}`);
      return loadImage(card.image, signal);
    }),
  );
  requireActive(signal);

  model.cards.forEach((card, index) => {
    const { x, y: cardsTop } = cardPlacements[index]!;
    context.save();
    roundedRect(context, x, cardsTop, cardWidth, cardHeight, 10);
    context.clip();
    context.fillStyle = "#b997c9";
    context.fillRect(x, cardsTop, cardWidth, cardHeight);
    const image = images[index];
    if (image) {
      if (card.orientation === "reversed") {
        context.translate(x + cardWidth / 2, cardsTop + cardHeight / 2);
        context.rotate(Math.PI);
        context.drawImage(image, -cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight);
      } else {
        context.drawImage(image, x, cardsTop, cardWidth, cardHeight);
      }
    }
    context.restore();
    context.strokeStyle = "rgba(184,145,95,0.72)";
    context.lineWidth = 2;
    roundedRect(context, x, cardsTop, cardWidth, cardHeight, 10);
    context.stroke();
  });

  context.textAlign = "center";
  context.textBaseline = "top";
  for (const block of textBlocks) {
    context.font = block.font;
    context.fillStyle = block.color;
    block.lines.forEach((line, index) => context.fillText(line, block.x, block.y + index * block.lineHeight));
  }

  if (model.downloadUrl) {
    const qr = await createQrCanvas(model.downloadUrl, 150);
    requireActive(signal);
    context.drawImage(qr, width / 2 - 75, height - 292, 150, 150);
  }
  context.fillStyle = "#7f7680";
  context.font = "600 18px Arial";
  wrapReceiptText(model.labels.footer, 700, value => context.measureText(value).width)
    .forEach((line, index) => context.fillText(line, width / 2, height - 112 + index * 23));

  return await new Promise<Blob>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Receipt export timed out")),
      5_000,
    );
    canvas.toBlob(
      (blob) => {
        window.clearTimeout(timer);
        if (blob) resolve(blob);
        else reject(new Error("Receipt export failed"));
      },
      "image/png",
      0.94,
    );
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

export type TarotReceiptShareOutcome = "shared" | "saved" | "cancelled";

export function isTarotShareCancellation(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  const message = error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "";
  const normalizedMessage = message.trim().toLowerCase();
  return normalizedMessage === "share canceled" || normalizedMessage === "share cancelled";
}

export async function shareTarotReceipt(
  blob: Blob,
  fileName: string,
  { signal, language = "en" }: ReceiptOperationOptions = {},
): Promise<TarotReceiptShareOutcome> {
  requireActive(signal);
  const capacitor = (window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  }).Capacitor;
  if (capacitor?.isNativePlatform?.()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    requireActive(signal);
    const data = await blobToBase64(blob);
    requireActive(signal);
    const cacheFileName = `${crypto.randomUUID()}-${fileName}`;
    try {
      await Filesystem.writeFile({
        path: cacheFileName,
        data,
        directory: Directory.Cache,
      });
      requireActive(signal);
      const uri = await Filesystem.getUri({
        path: cacheFileName,
        directory: Directory.Cache,
      });
      requireActive(signal);
      try {
        await Share.share({
          title: translateText("My Hint tarot reading", language),
          text: translateText("A reading from Hint", language),
          files: [uri.uri],
          dialogTitle: translateText("Share your Hint reading", language),
        });
      } catch (error) {
        if (isTarotShareCancellation(error)) return "cancelled" as const;
        throw error;
      }
    } finally {
      await Filesystem.deleteFile({
        path: cacheFileName,
        directory: Directory.Cache,
      }).catch(() => undefined);
    }
    return "shared" as const;
  }

  const file = new File([blob], fileName, { type: "image/png" });
  const webNavigator = navigator as unknown as {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };
  let canShareFile = false;
  try {
    canShareFile = Boolean(
      typeof webNavigator.share === "function" &&
        typeof webNavigator.canShare === "function" &&
        webNavigator.canShare({ files: [file] }),
    );
  } catch {
    canShareFile = false;
  }
  if (canShareFile && webNavigator.share) {
    try {
      await webNavigator.share({ title: translateText("My Hint tarot reading", language), files: [file] });
    } catch (error) {
      if (isTarotShareCancellation(error)) return "cancelled" as const;
      throw error;
    }
    return "shared" as const;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "saved" as const;
}
