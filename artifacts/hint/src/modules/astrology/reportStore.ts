import { captureIdentityContext } from "@/lib/identity";
import { withIdentityLock } from "@/lib/identityLock";
import { historyClearVersion } from "@/lib/clearHistory";
import type { CelestialLetter } from "./reportModel";

const DATABASE = "hint-celestial-letters-v1",
  TABLE = "letters";
export const LETTERS_CHANGED = "hint.celestialLetters.changed";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined")
      return reject(new Error("Device storage is unavailable"));
    const request = indexedDB.open(DATABASE, 1);
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new Error("Device storage did not open"));
    }, 3000);
    const fail = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(request.error ?? new Error("Device storage is busy"));
    };
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(TABLE, {
        keyPath: ["owner", "id"],
      });
      store.createIndex("owner", "owner");
    };
    request.onerror = fail;
    request.onblocked = fail;
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(request.result);
    };
  });
}
function valid(
  record: CelestialLetter,
  owner: string,
  version: string,
): boolean {
  return Boolean(
    record &&
    typeof record.id === "string" &&
    Number.isFinite(Date.parse(record.createdAt)) &&
    record.charts?.user?.birthProfile &&
    record.schemaVersion === 1 &&
    record.owner === owner &&
    record.clearVersion === version &&
    record.charts?.user?.placements?.length &&
    record.text &&
    ["en", "zh", "es", "ja", "ko"].every((lang) =>
      Array.isArray(record.text[lang as keyof typeof record.text]?.chapters),
    ),
  );
}
export async function listLetters(owner: string): Promise<CelestialLetter[]> {
  const identity = captureIdentityContext(),
    version = historyClearVersion(owner);
  if (identity.owner !== owner)
    throw new DOMException("Profile changed", "AbortError");
  const db = await openDatabase();
  try {
    identity.assertCurrent();
    const rows = await new Promise<CelestialLetter[]>((resolve, reject) => {
      const tx = db.transaction(TABLE, "readonly"),
        request = tx.objectStore(TABLE).index("owner").getAll(owner);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    identity.assertCurrent();
    if (version !== historyClearVersion(owner)) return [];
    return rows
      .filter((row) => valid(row, owner, version))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } finally {
    db.close();
  }
}
export async function saveLetter(
  letter: CelestialLetter,
): Promise<{ ok: true; letter: CelestialLetter } | { ok: false }> {
  const identity = captureIdentityContext();
  const current = () => {
    identity.assertCurrent();
    if (
      identity.owner !== letter.owner ||
      historyClearVersion(letter.owner) !== letter.clearVersion
    )
      throw new DOMException("Reading changed", "AbortError");
  };
  try {
    return await withIdentityLock(async () => {
      current();
      const db = await openDatabase();
      try {
        current();
        const saved = {
          ...structuredClone(letter),
          savedAt: new Date().toISOString(),
        };
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(TABLE, "readwrite");
          const abort = () => {
            try {
              tx.abort();
            } catch {
              /* Already committed; owner/version checks still apply. */
            }
          };
          identity.signal.addEventListener("abort", abort, { once: true });
          const cleanup = () =>
            identity.signal.removeEventListener("abort", abort);
          tx.oncomplete = () => {
            cleanup();
            resolve();
          };
          tx.onerror = () => {
            cleanup();
            reject(tx.error);
          };
          tx.onabort = () => {
            cleanup();
            reject(tx.error ?? new Error("Storage cancelled"));
          };
          tx.objectStore(TABLE).put(saved);
        });
        current();
        window.dispatchEvent(new Event(LETTERS_CHANGED));
        return { ok: true as const, letter: saved };
      } finally {
        db.close();
      }
    });
  } catch {
    return { ok: false };
  }
}
/** Caller holds the identity lock after the server commits and the clear marker is durable. */
export async function clearLetters(owner: string): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TABLE, "readwrite");
      const request = tx
        .objectStore(TABLE)
        .index("owner")
        .openKeyCursor(IDBKeyRange.only(owner));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          tx.objectStore(TABLE).delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    window.dispatchEvent(new Event(LETTERS_CHANGED));
  } finally {
    db.close();
  }
}
