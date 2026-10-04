import { afterEach, describe, expect, it, vi } from "vitest";
import type { RitualCard } from "../types/ritual.types";
import { getAnonId } from "../../../lib/identity";
import {
  clearActiveTarotSession,
  loadActiveTarotSession,
  saveActiveTarotSession,
  updateActiveTarotSessionArchive,
} from "./activeTarotSession";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}
function installDefaultStorages(durable: ReturnType<typeof memoryStorage>, fallback: ReturnType<typeof memoryStorage>) {
  durable.setItem("hint_anon_id", getAnonId());
  vi.stubGlobal("localStorage", durable);
  vi.stubGlobal("window", { localStorage: durable, sessionStorage: fallback });
}
const ownedKey = () => `hint_active_tarot_reading_v2:${getAnonId()}`;

function selectedCard(): RitualCard {
  return {
    visualId: "visual-24",
    cardId: "24-card",
    name: "Card 24",
    orientation: "reversed",
    x: 50,
    y: 50,
    rotation: 0,
    rotate: 0,
    zIndex: 24,
    selected: true,
    revealed: true,
  };
}

function sessionInput() {
  return {
    phase: "reading" as const,
    question: "What is opening now?",
    spreadId: "three",
    focusLabel: "Clear signal",
    design: {
      id: "deep-sea",
      label: "Deep Sea",
      mood: "quiet",
      deckStyleId: "nocturne",
      backStyle: "nocturne",
      cardBackId: "moon-tide",
      cardArtId: "original",
      backgroundId: "sea",
      background: "sea",
      glow: "#fff",
    },
    selectedCards: [selectedCard()],
    revealedIds: ["visual-24"],
  };
}

describe("active tarot session persistence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not read, overwrite, or clear another profile's restored recovery before reload", () => {
    const durable = memoryStorage();
    const fallback = memoryStorage();
    vi.stubGlobal("localStorage", durable);
    vi.stubGlobal("window", { localStorage: durable, sessionStorage: fallback });
    const oldOwner = getAnonId();
    saveActiveTarotSession(sessionInput(), durable, 1000);
    const restored = durable.getItem("hint_active_tarot_reading_v1");
    durable.setItem("hint_anon_id", `${oldOwner}-new-profile`);
    expect(loadActiveTarotSession(undefined, 2000)).toBeNull();
    saveActiveTarotSession({ ...sessionInput(), question: "Old tab's late draft" }, undefined, 2000);
    clearActiveTarotSession();
    expect(durable.getItem("hint_active_tarot_reading_v1")).toBe(restored);
  });

  it("restores the exact selected identity and orientation after refresh", () => {
    const storage = memoryStorage();
    saveActiveTarotSession(sessionInput(), storage, 1000);
    const restored = loadActiveTarotSession(storage, 2000);

    expect(restored?.selectedCards[0]).toMatchObject({
      visualId: "visual-24",
      cardId: "24-card",
      orientation: "reversed",
    });
    expect(restored?.revealedIds).toEqual(["visual-24"]);
    expect(restored?.phase).toBe("reading");
  });

  it("keeps one stable reading archive ID across a refresh", () => {
    const storage = memoryStorage();
    saveActiveTarotSession(sessionInput(), storage, Date.now());
    updateActiveTarotSessionArchive("tarot-stable", "2026-09-01T20:00:00.000Z", storage);

    expect(loadActiveTarotSession(storage)?.readingId).toBe("tarot-stable");
  });

  it("uses durable storage by default so iOS process termination can recover", () => {
    const durableStorage = memoryStorage();
    const sessionStorage = memoryStorage();
    installDefaultStorages(durableStorage, sessionStorage);

    saveActiveTarotSession(sessionInput(), undefined, 1000);

    expect(durableStorage.getItem(ownedKey())).not.toBeNull();
    expect(sessionStorage.getItem(ownedKey())).toBe("null");
  });

  it("migrates a legacy browser-session recovery into durable storage", () => {
    const durableStorage = memoryStorage();
    const sessionStorage = memoryStorage();
    saveActiveTarotSession(sessionInput(), sessionStorage, 1000);
    installDefaultStorages(durableStorage, sessionStorage);

    const restored = loadActiveTarotSession(undefined, 2000);

    expect(restored?.phase).toBe("reading");
    expect(durableStorage.getItem(ownedKey())).not.toBeNull();
    expect(sessionStorage.getItem(ownedKey())).toBe("null");
  });

  it("clears both durable and fallback recovery without re-importing legacy copies", () => {
    const durableStorage = memoryStorage();
    const sessionStorage = memoryStorage();
    saveActiveTarotSession(sessionInput(), durableStorage, 1000);
    saveActiveTarotSession(sessionInput(), sessionStorage, 1000);
    installDefaultStorages(durableStorage, sessionStorage);

    clearActiveTarotSession();

    expect(durableStorage.getItem(ownedKey())).toBe("null");
    expect(sessionStorage.getItem(ownedKey())).toBe("null");
    expect(loadActiveTarotSession(undefined, 2000)).toBeNull();
  });

  it("restores the newest fallback when durable storage still contains an older session", () => {
    const durable = memoryStorage();
    const fallback = memoryStorage();
    installDefaultStorages(durable, fallback);
    saveActiveTarotSession(sessionInput(), undefined, 1000);
    const write = vi.spyOn(durable, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    saveActiveTarotSession({ ...sessionInput(), question: "The newer question" }, undefined, 2000);

    expect(loadActiveTarotSession(undefined, 3000)?.question).toBe("The newer question");
    expect(fallback.getItem(ownedKey())).not.toBeNull();
    write.mockRestore();
    expect(loadActiveTarotSession(undefined, 3000)?.question).toBe("The newer question");
    expect(fallback.getItem(ownedKey())).toBe("null");
    expect(JSON.parse(durable.getItem(ownedKey())!).question).toBe("The newer question");
  });

  it("removes obsolete fallback state once a new durable save succeeds", () => {
    const durable = memoryStorage();
    const fallback = memoryStorage();
    saveActiveTarotSession(sessionInput(), fallback, 1000);
    installDefaultStorages(durable, fallback);
    saveActiveTarotSession({ ...sessionInput(), question: "The final question" }, undefined, 2000);
    expect(fallback.getItem(ownedKey())).toBe("null");
    expect(loadActiveTarotSession(undefined, 3000)?.question).toBe("The final question");
  });

  it("orders rapid saves even when both writes share the same clock millisecond", () => {
    const durable = memoryStorage();
    const fallback = memoryStorage();
    installDefaultStorages(durable, fallback);
    saveActiveTarotSession(sessionInput(), undefined, 1000);
    vi.spyOn(durable, "setItem").mockImplementation(() => { throw new Error("Quota exceeded"); });
    saveActiveTarotSession({ ...sessionInput(), question: "Second question" }, undefined, 1000);
    saveActiveTarotSession({ ...sessionInput(), question: "Third question" }, undefined, 1000);
    const restored = loadActiveTarotSession(undefined, 2000);
    expect(restored?.question).toBe("Third question");
    expect(restored?.savedAt).toBe(1002);
  });

  it("prefers durable state on equal timestamps and ignores malformed fallback state", () => {
    const durable = memoryStorage();
    const fallback = memoryStorage();
    saveActiveTarotSession(sessionInput(), durable, 1000);
    saveActiveTarotSession({ ...sessionInput(), question: "An obsolete fallback" }, fallback, 1000);
    installDefaultStorages(durable, fallback);
    expect(loadActiveTarotSession(undefined, 2000)?.question).toBe(sessionInput().question);
    fallback.setItem("hint_active_tarot_reading_v1", "{broken");
    expect(loadActiveTarotSession(undefined, 2000)?.question).toBe(sessionInput().question);
  });

  it("drops expired, malformed, or explicitly cleared sessions", () => {
    const storage = memoryStorage();
    saveActiveTarotSession(sessionInput(), storage, 1000);
    expect(loadActiveTarotSession(storage, 13 * 60 * 60 * 1000)).toBeNull();

    storage.setItem("hint_active_tarot_reading_v1", "{bad json");
    expect(loadActiveTarotSession(storage)).toBeNull();

    saveActiveTarotSession(sessionInput(), storage);
    clearActiveTarotSession(storage);
    expect(loadActiveTarotSession(storage)).toBeNull();
  });

  async function scopedRecovery() {
    vi.resetModules();
    const durable = memoryStorage(); const fallback = memoryStorage();
    durable.setItem("hint_anon_id", "recovery-owner");
    vi.stubGlobal("localStorage", durable);
    vi.stubGlobal("window", { localStorage: durable, sessionStorage: fallback });
    const recovery = await import("./activeTarotSession");
    return { durable, fallback, recovery };
  }

  it("cannot overwrite the next owner's recovery if switching starts between the owner check and storage write", async () => {
    const { durable, recovery } = await scopedRecovery();
    const other = JSON.stringify({ ...sessionInput(), question: "Other owner's private reading", version: 1, savedAt: 1000 });
    durable.setItem("hint_active_tarot_reading_v1", other);
    durable.setItem("hint_active_tarot_reading_v2:other-owner", other);
    const read = durable.getItem; let switchOnce = true;
    vi.spyOn(durable, "getItem").mockImplementation(key => {
      if (switchOnce && key.startsWith("hint_active_tarot_reading_")) {
        switchOnce = false; durable.setItem("hint_anon_id", "other-owner");
        durable.setItem("hint_identity_generation_v1", "new-generation");
      }
      return read(key);
    });
    recovery.saveActiveTarotSession(sessionInput(), undefined, 2000);
    expect(durable.getItem("hint_active_tarot_reading_v1")).toBe(other);
    expect(durable.getItem("hint_active_tarot_reading_v2:other-owner")).toBe(other);
  });

  it("does not restore another tab's pre-deletion session fallback into durable storage", async () => {
    const { durable, fallback, recovery } = await scopedRecovery();
    recovery.saveActiveTarotSession(sessionInput(), fallback, 1000);
    durable.setItem("hint_history_clear_version_v1:recovery-owner", "deleted-reading");
    expect(recovery.loadActiveTarotSession(undefined, 2000)).toBeNull();
    expect(durable.getItem("hint_active_tarot_reading_v1")).toBeNull();
    expect(durable.getItem("hint_active_tarot_reading_v2:recovery-owner")).toBeNull();
  });

  it("fences mounted pre-deletion saves until an explicit new reading starts", async () => {
    const { durable, recovery } = await scopedRecovery();
    recovery.saveActiveTarotSession(sessionInput(), undefined, 1000);
    durable.setItem("hint_history_clear_version_v1:recovery-owner", "deleted-reading");
    durable.removeItem("hint_active_tarot_reading_v1");
    durable.removeItem("hint_active_tarot_reading_v2:recovery-owner");
    recovery.saveActiveTarotSession({ ...sessionInput(), question: "Old late response" }, undefined, 2000);
    expect(durable.getItem("hint_active_tarot_reading_v1")).toBeNull();
    expect(durable.getItem("hint_active_tarot_reading_v2:recovery-owner")).toBeNull();
    recovery.clearActiveTarotSession();
    recovery.saveActiveTarotSession({ ...sessionInput(), question: "Explicit new reading" }, undefined, 3000);
    expect(recovery.loadActiveTarotSession(undefined, 4000)?.question).toBe("Explicit new reading");
    expect(JSON.parse(durable.getItem("hint_active_tarot_reading_v2:recovery-owner")!)).toMatchObject({ owner: "recovery-owner", clearVersion: "deleted-reading" });
  });
});
