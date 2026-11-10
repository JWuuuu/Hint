import type { LocalTarotReading } from "../../readings/localTarotReadings";
import { getTarotCardImage } from "./cardImageMap";
import { getTarotReceiptInsight } from "./receiptPrivacy";
import { getReceiptCardCaption } from "./receiptCardCaptions";
import { hintDownloadUrl, validatePublicUrl } from "@/lib/publicUrls";
import { translateText } from "../../../lib/LocalizedText";
import type { HintLanguage } from "../../../lib/i18n";
import { receiptCardName, receiptPosition, receiptSpreadLabel, receiptOriginalTextLabel } from "./receiptCopy";
import { createReceiptPng } from "./receiptPng";
import { buildDailyReceiptArtwork, type ReceiptMeasure } from "../../receipt-printer/dailyReceiptArtwork";
import { buildTarotReceiptArtwork } from "../../receipt-printer/tarotReceiptArtwork";
import { receiptText } from "../../receipt-printer/receiptStrings";
import type { DailyScoreKey } from "../../home/types/home.types";
import { isNativeShell } from "../../../lib/mobile/runtime";

export { getTarotReceiptCardLayout } from "./receiptLayout";

export type TarotReceiptModel = {
  theme?: "bright" | "dark";
  kind?: "daily";
  spreadType?: string;
  language?: HintLanguage;
  title: string;
  date: string;
  insight: string;
  question?: string;
  personal?: boolean;
  cards: Array<{
    name: string;
    position: string;
    orientation: "upright" | "reversed";
    image?: string;
    meaning?: string;
  }>;
  downloadUrl?: string;
  details?: Array<{ label: string; value: string }>;
  daily?: {
    scores: Array<{ key: DailyScoreKey; label: string; score: number }>;
    lucky: Array<{ key: "color" | "number"; label: string; value: string; swatch?: string }>;
  };
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
    spreadType: reading.spreadType,
    title: receiptSpreadLabel(reading.spreadType, language),
    date: new Date(reading.createdAt).toLocaleDateString(language, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    personal: includeQuestion,
    insight: getTarotReceiptInsight(reading.cards, reading.shortAnswer, includeQuestion),
    question: includeQuestion ? reading.question?.trim() || undefined : undefined,
    cards: reading.cards.map((card, index) => ({
      name: receiptCardName(card.cardId, index, language),
      position: receiptPosition(reading.spreadType, index, language),
      orientation: card.orientation,
      // A compact canonical reflection under each card, without archived private copy.
      meaning: getReceiptCardCaption(card.cardId, card.orientation),
      image: getTarotCardImage(
        card.cardId,
        reading.roomDesign?.cardArtId ?? reading.cardArtId ?? "original",
      ) ?? undefined,
    })),
    downloadUrl,
    labels: {
      brand: translateText("HINT TAROT", language), reading: translateText("YOUR READING", language),
      footer: receiptText(language, "tarotFooter"),
      originalText: receiptOriginalTextLabel(includeQuestion && Boolean(reading.shortAnswer.trim()), language),
    },
  };
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

/** Keep the printed reading intact and add the common download footer to exports. */
export async function createTarotReceiptBlob(model: TarotReceiptModel, { signal }: ReceiptOperationOptions = {}) {
  requireActive(signal);
  const embeddedImages = await Promise.all(model.cards.map(async card => {
    if (!card.image) throw new Error("Receipt artwork unavailable");
    const image = await loadImage(card.image, signal);
    requireActive(signal);
    const artworkCanvas = document.createElement("canvas");
    artworkCanvas.width = image.naturalWidth;
    artworkCanvas.height = image.naturalHeight;
    const artworkContext = artworkCanvas.getContext("2d");
    if (!artworkContext) throw new Error("Canvas unavailable");
    artworkContext.drawImage(image, 0, 0);
    return artworkCanvas.toDataURL("image/png");
  }));
  requireActive(signal);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const measure: ReceiptMeasure = (text, size, weight) => {
    context.font = `${weight} ${size}px Georgia, "Times New Roman", serif`;
    return context.measureText(text).width;
  };
  const artwork = model.kind === "daily"
    ? buildDailyReceiptArtwork(model, measure, embeddedImages[0], false, { downloadFooter: true })
    : buildTarotReceiptArtwork(model, measure, embeddedImages, false, { downloadFooter: true });
  const svgUrl = URL.createObjectURL(new Blob([artwork.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const sheet = await loadImage(svgUrl, signal);
    requireActive(signal);
    canvas.width = artwork.width * 2;
    canvas.height = artwork.height * 2;
    context.scale(2, 2);
    context.drawImage(sheet, 0, 0, artwork.width, artwork.height);
    return await createReceiptPng(canvas, signal);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
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

function downloadReceipt(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}

/** Save the prepared image locally; this action never opens the share sheet. */
export async function saveTarotReceipt(blob: Blob, fileName: string, { signal }: ReceiptOperationOptions = {}): Promise<"photos" | "downloaded"> {
  requireActive(signal);
  if (!isNativeShell()) {
    downloadReceipt(blob, fileName);
    return "downloaded";
  }
  const { photoLibrary } = await import("../../../lib/mobile/photoLibrary");
  requireActive(signal);
  const { granted } = await photoLibrary.requestSavePermission();
  requireActive(signal);
  if (!granted) throw Object.assign(new Error("Photo permission denied"), { code: "PHOTO_PERMISSION_DENIED" });
  const base64 = await blobToBase64(blob);
  requireActive(signal);
  await photoLibrary.saveImage({ base64, fileName });
  requireActive(signal);
  return "photos";
}

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

  downloadReceipt(blob, fileName);
  return "saved" as const;
}
