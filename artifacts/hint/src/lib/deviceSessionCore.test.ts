import { describe, expect, it, vi } from "vitest";
import { createDeviceSessionManager } from "./deviceSessionCore";

const session = { token: "a".repeat(48), ownerId: "server-owner", expiresAt: "2030-01-01T00:00:00Z" };
describe("device session persistence and ownership", () => {
  it("enrolls once for concurrent requests and persists before returning a credential", async () => {
    let saved: string | null = null;
    const enroll = vi.fn(async () => session);
    const manager = createDeviceSessionManager({ read: async () => saved, write: async value => { saved = value; }, enroll });
    expect(await Promise.all([manager.getToken(), manager.getToken()])).toEqual([session.token, session.token]);
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(saved).toBe(JSON.stringify(session));
  });
  it("enrolls once across separate managers sharing the same storage and exclusive lock", async () => {
    let saved: string | null = null;
    let queue = Promise.resolve();
    const withLock = <T,>(work: () => Promise<T>): Promise<T> => {
      const next = queue.then(work); queue = next.then(() => undefined, () => undefined); return next;
    };
    const enroll = vi.fn(async () => ({ ...session, token: String(enroll.mock.calls.length).repeat(48) }));
    const dependencies = { read: async () => saved, write: async (value: string) => { saved = value; }, enroll, withLock };
    const first = createDeviceSessionManager(dependencies);
    const second = createDeviceSessionManager(dependencies);
    const tokens = await Promise.all([first.getToken(), second.getToken()]);
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(tokens[0]).toBe(tokens[1]);
    expect(await createDeviceSessionManager(dependencies).getToken()).toBe(tokens[0]);
  });
  it("does not return a cached credential after its persisted owner changes", async () => {
    let saved = JSON.stringify(session);
    const manager = createDeviceSessionManager({ read: async () => saved, write: vi.fn(), enroll: vi.fn() });
    await manager.getToken();
    saved = JSON.stringify({ ...session, token: "b".repeat(48), ownerId: "different-owner" });
    await expect(manager.getToken()).rejects.toMatchObject({ reason: "storage" });
  });
  it("keeps the issued credential for retry after quota failure, without allowing a request", async () => {
    const enroll = vi.fn(async () => session);
    const write = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue(undefined);
    const manager = createDeviceSessionManager({ read: async () => null, write, enroll });
    await expect(manager.getToken()).rejects.toMatchObject({ reason: "storage" });
    await expect(manager.getToken()).resolves.toBe(session.token);
    expect(enroll).toHaveBeenCalledTimes(1);
  });
  it.each(["broken", JSON.stringify({ ...session, expiresAt: "2000-01-01" })])("does not replace an unreadable or expired stored owner", async value => {
    const enroll = vi.fn(async () => session);
    const manager = createDeviceSessionManager({ read: async () => value, write: vi.fn(), enroll });
    await expect(manager.getToken()).rejects.toBeDefined();
    expect(enroll).not.toHaveBeenCalled();
  });
  it("does not enroll when credential storage cannot be read", async () => {
    const enroll = vi.fn(async () => session);
    const manager = createDeviceSessionManager({ read: async () => { throw new Error("locked"); }, write: vi.fn(), enroll });
    await expect(manager.getToken()).rejects.toMatchObject({ reason: "storage" });
    expect(enroll).not.toHaveBeenCalled();
  });
  it("isolates late rejection from another owner and never silently re-enrolls a revoked session", async () => {
    const enroll = vi.fn(async () => session);
    const manager = createDeviceSessionManager({ read: async () => JSON.stringify(session), write: vi.fn(), enroll });
    await manager.getToken();
    manager.invalidate("b".repeat(48));
    await expect(manager.getToken()).resolves.toBe(session.token);
    manager.invalidate(session.token);
    await expect(manager.getToken()).rejects.toMatchObject({ reason: "revoked" });
    expect(enroll).not.toHaveBeenCalled();
  });
});
