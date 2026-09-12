export type DeviceSession = { token: string; ownerId: string; expiresAt: string };
export type DeviceSessionFailure = "unavailable" | "storage" | "expired" | "revoked";
export class DeviceSessionError extends Error {
  constructor(public readonly reason: DeviceSessionFailure) { super(`Device connection: ${reason}`); }
}

type Dependencies = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  enroll: () => Promise<DeviceSession>;
  onFailure?: (reason: DeviceSessionFailure | null) => void;
  now?: () => number;
  withLock?: <T>(work: () => Promise<T>) => Promise<T>;
};

function parseSession(value: unknown): DeviceSession {
  const session = value as Partial<DeviceSession> | null;
  if (!session || typeof session.token !== "string" || session.token.length < 32 ||
      typeof session.ownerId !== "string" || !session.ownerId ||
      typeof session.expiresAt !== "string" || !Number.isFinite(Date.parse(session.expiresAt))) {
    throw new DeviceSessionError("storage");
  }
  return session as DeviceSession;
}

/** Never authorizes an old anonymous ID or replaces an expired/revoked owner. */
export function createDeviceSessionManager(deps: Dependencies) {
  let session: DeviceSession | null = null;
  let persisted = false;
  let pending: Promise<string> | null = null;
  let revoked = false;
  async function load(): Promise<string> {
    try {
      if (revoked) throw new DeviceSessionError("revoked");
      let stored: string | null;
      try { stored = await deps.read(); } catch (error) {
        if ((error as { name?: string })?.name === "AbortError") throw error;
        throw new DeviceSessionError("storage");
      }
      if (stored !== null) {
        let durable: DeviceSession;
        try { durable = parseSession(JSON.parse(stored)); } catch { throw new DeviceSessionError("storage"); }
        if (persisted && (session?.token !== durable.token || session.ownerId !== durable.ownerId)) throw new DeviceSessionError("storage");
        session = durable; persisted = true;
      } else if (persisted) {
        throw new DeviceSessionError("storage");
      } else if (!session) {
        try { session = parseSession(await deps.enroll()); }
        catch (error) { throw error instanceof DeviceSessionError ? error : new DeviceSessionError("unavailable"); }
      }
      if (Date.parse(session.expiresAt) <= (deps.now?.() ?? Date.now())) throw new DeviceSessionError("expired");
      if (!persisted) {
        // Retain a newly issued token in memory for a storage retry, but do not
        // send personal data until the credential itself is durably saved.
        try { await deps.write(JSON.stringify(session)); persisted = true; }
        catch { throw new DeviceSessionError("storage"); }
      }
      deps.onFailure?.(null);
      return session.token;
    } catch (error) {
      if ((error as { name?: string })?.name === "AbortError") throw error;
      const failure = error instanceof DeviceSessionError ? error : new DeviceSessionError("unavailable");
      deps.onFailure?.(failure.reason);
      throw failure;
    }
  }
  return {
    getToken(): Promise<string> {
      if (!pending) pending = (deps.withLock ? deps.withLock(load) : load()).catch(error => {
        if (error instanceof DeviceSessionError || (error as { name?: string })?.name === "AbortError") throw error;
        const failure = new DeviceSessionError("storage");
        deps.onFailure?.(failure.reason);
        throw failure;
      }).finally(() => { pending = null; });
      return pending;
    },
    invalidate(token: string) {
      if (session?.token !== token) return;
      revoked = true; deps.onFailure?.("revoked");
    },
  };
}
