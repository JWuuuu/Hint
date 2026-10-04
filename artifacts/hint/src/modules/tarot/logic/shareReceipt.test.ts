/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildTarotReceiptModel, shareTarotReceipt } from "./shareReceipt";
import type { LocalTarotReading } from "../../readings/localTarotReadings";
import { TRANSLATIONS, type HintLanguage } from "../../../lib/i18n";

const nativeMocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  getUri: vi.fn(),
  deleteFile: vi.fn(),
  share: vi.fn(),
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: {
    writeFile: nativeMocks.writeFile,
    getUri: nativeMocks.getUri,
    deleteFile: nativeMocks.deleteFile,
  },
}));

vi.mock("@capacitor/share", () => ({
  Share: { share: nativeMocks.share },
}));

function setCapacitor(native: boolean) {
  Object.defineProperty(window, "Capacitor", {
    configurable: true,
    value: native ? { isNativePlatform: () => true } : undefined,
  });
}

function setWebShare(
  share?: (data: ShareData) => Promise<void>,
  canShare?: (data?: ShareData) => boolean,
) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: share,
  });
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    value: canShare,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  setCapacitor(false);
  setWebShare(undefined, undefined);
  nativeMocks.writeFile.mockResolvedValue(undefined);
  nativeMocks.getUri.mockResolvedValue({ uri: "file:///receipt/hint-reading.png" });
  nativeMocks.deleteFile.mockResolvedValue(undefined);
  nativeMocks.share.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Tarot receipt sharing", () => {
  const archived: LocalTarotReading = { schemaVersion: 2, id: "fixture", anonId: "fixture", source: "tarot", spreadType: "three", spreadLabel: "Three cards", cards: [{ cardId: "2-high-priestess", name: "PRIVATE ARCHIVED NAME", positionLabel: "PRIVATE ARCHIVED POSITION", keywords: ["PRIVATE KEYWORD"], orientation: "reversed" }], shortAnswer: "PRIVATE GENERATED ANSWER", question: "PRIVATE QUESTION", questionMeaning: "PRIVATE MEANING", cardMeanings: [], chatMessages: [], createdAt: "2026-09-02T12:00:00Z" };
  it.each(["en", "zh", "es", "ja", "ko"] as HintLanguage[])("localizes %s receipt labels, canonical cards and dates without changing saved text", language => {
    const original = JSON.stringify(archived);
    const model = buildTarotReceiptModel(archived, false, "https://hint.example/download", language);
    expect(model.title).toBe(TRANSLATIONS[language]["tarot.spread.three.label"]);
    expect(model.cards[0]?.position).toBe(TRANSLATIONS[language]["tarot.spread.three.positionLabels"].split("|")[0]);
    expect(model.cards[0]?.orientation).toBe("reversed");
    expect(model.date).toBe(new Date(archived.createdAt).toLocaleDateString(language, { month: "long", day: "numeric", year: "numeric" }));
    expect(JSON.stringify(model)).not.toContain("PRIVATE");
    expect(JSON.stringify(archived)).toBe(original);
    if (language !== "en") {
      expect(model.cards[0]?.name).not.toBe("The High Priestess");
      expect(model.labels.reading).not.toBe("YOUR READING");
      expect(model.labels.footer).not.toBe("Open your own reading in Hint");
      expect(model.labels.originalText).toBeTruthy();
    }
    const optedIn = buildTarotReceiptModel(archived, true, "https://hint.example/download", language);
    expect(optedIn.insight).toBe(archived.shortAnswer);
    expect(optedIn.question).toBe(archived.question);
    if (language !== "en") expect(optedIn.labels.originalText).toBe(TRANSLATIONS[language]["quality.originalText"]);
  });
  it("unknown card or spread IDs never invent a card or expose archived metadata", () => {
    const unknown = { ...archived, spreadType: "unknown", spreadLabel: "PRIVATE TITLE", cards: [{ ...archived.cards[0]!, cardId: "unknown" }] };
    const model = buildTarotReceiptModel(unknown, false, "https://hint.example/download", "ja");
    expect(JSON.stringify(model)).not.toContain("PRIVATE");
    expect(model.cards[0]?.name).toBe(TRANSLATIONS.ja["tarot.flow.pick.card"].replace("{number}", "1"));
  });
  it("uses native cache and always removes the temporary iOS share file", async () => {
    setCapacitor(true);
    const receipt = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

    await expect(
      shareTarotReceipt(receipt, "hint-reading.png"),
    ).resolves.toBe("shared");
    const cacheFileName = nativeMocks.writeFile.mock.calls[0]![0].path;
    expect(cacheFileName).toMatch(/^[\da-f-]+-hint-reading\.png$/);
    expect(nativeMocks.writeFile).toHaveBeenCalledWith({
      path: cacheFileName,
      data: "AQID",
      directory: "CACHE",
    });
    expect(nativeMocks.share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ["file:///receipt/hint-reading.png"],
      }),
    );
    expect(nativeMocks.deleteFile).toHaveBeenCalledWith({
      path: cacheFileName,
      directory: "CACHE",
    });
  });

  it("removes the temporary iOS file when its share URI cannot be created", async () => {
    setCapacitor(true);
    nativeMocks.getUri.mockRejectedValueOnce(new Error("URI unavailable"));

    await expect(
      shareTarotReceipt(new Blob(["receipt"]), "hint-reading.png"),
    ).rejects.toThrow("URI unavailable");
    expect(nativeMocks.share).not.toHaveBeenCalled();
    expect(nativeMocks.deleteFile).toHaveBeenCalledWith({
      path: nativeMocks.writeFile.mock.calls[0]![0].path,
      directory: "CACHE",
    });
  });

  it("treats cancelling the iOS share sheet as a neutral outcome and removes the temporary file", async () => {
    setCapacitor(true);
    nativeMocks.share.mockRejectedValueOnce(new Error("Share canceled"));

    await expect(
      shareTarotReceipt(new Blob(["receipt"]), "hint-reading.png"),
    ).resolves.toBe("cancelled");
    expect(nativeMocks.deleteFile).toHaveBeenCalledWith({
      path: nativeMocks.writeFile.mock.calls[0]![0].path,
      directory: "CACHE",
    });
  });

  it("uses the browser share sheet when file sharing is supported", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setWebShare(share, () => true);
    const receipt = new Blob(["receipt"], { type: "image/png" });

    await expect(
      shareTarotReceipt(receipt, "hint-reading.png"),
    ).resolves.toBe("shared");
    expect(share).toHaveBeenCalledOnce();
    expect(share.mock.calls[0]?.[0]?.files?.[0]?.name).toBe("hint-reading.png");
  });

  it("does not open an iOS share sheet after cancellation during file preparation", async () => {
    setCapacitor(true);
    let finishWrite!: () => void;
    nativeMocks.writeFile.mockImplementationOnce(() => new Promise<void>((resolve) => { finishWrite = resolve; }));
    const controller = new AbortController();
    const pending = shareTarotReceipt(new Blob(["private receipt"]), "hint-reading.png", { signal: controller.signal });
    const result = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(nativeMocks.writeFile).toHaveBeenCalledOnce());
    const cancelledPath = nativeMocks.writeFile.mock.calls[0]![0].path;
    controller.abort();
    finishWrite();
    await result;
    expect(nativeMocks.share).not.toHaveBeenCalled();
    expect(nativeMocks.getUri).not.toHaveBeenCalled();
    expect(nativeMocks.deleteFile).toHaveBeenCalledWith({ path: cancelledPath, directory: "CACHE" });
    await shareTarotReceipt(new Blob(["next receipt"]), "hint-reading.png");
    expect(nativeMocks.writeFile.mock.calls[1]![0].path).not.toBe(cancelledPath);
    expect(nativeMocks.share).toHaveBeenCalledOnce();
  });

  it("never opens a browser share sheet for an already cancelled operation", async () => {
    const share = vi.fn();
    setWebShare(share, () => true);
    const controller = new AbortController();
    controller.abort();
    await expect(shareTarotReceipt(new Blob(["private receipt"]), "hint-reading.png", { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(share).not.toHaveBeenCalled();
  });

  it("keeps genuine native share failures visible and still removes the file", async () => {
    setCapacitor(true);
    nativeMocks.share.mockRejectedValueOnce(new Error("Error sharing item"));
    await expect(
      shareTarotReceipt(new Blob(["receipt"]), "hint-reading.png"),
    ).rejects.toThrow("Error sharing item");
    expect(nativeMocks.deleteFile).toHaveBeenCalledOnce();
  });

  it("does not mistake browser permission failure for cancellation", async () => {
    setWebShare(vi.fn().mockRejectedValue(new DOMException("Share not allowed", "NotAllowedError")), () => true);
    await expect(
      shareTarotReceipt(new Blob(["receipt"]), "hint-reading.png"),
    ).rejects.toMatchObject({ name: "NotAllowedError" });
  });

  it("treats cancelling the browser share sheet as a neutral outcome", async () => {
    const share = vi.fn().mockRejectedValue(
      new DOMException("The share request was cancelled", "AbortError"),
    );
    setWebShare(share, () => true);

    await expect(
      shareTarotReceipt(new Blob(["receipt"]), "hint-reading.png"),
    ).resolves.toBe("cancelled");
  });

  it("downloads the image when no share sheet is available", async () => {
    vi.useFakeTimers();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => "blob:hint-receipt");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });

    await expect(
      shareTarotReceipt(
        new Blob(["receipt"], { type: "image/png" }),
        "hint-reading.png",
      ),
    ).resolves.toBe("saved");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:hint-receipt");
  });

  it("downloads the image when browser file-share detection throws", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:hint-receipt"),
    });
    setWebShare(vi.fn(), () => {
      throw new Error("unsupported share data");
    });

    await expect(
      shareTarotReceipt(new Blob(["receipt"]), "hint-reading.png"),
    ).resolves.toBe("saved");
    expect(click).toHaveBeenCalledOnce();
  });
});
