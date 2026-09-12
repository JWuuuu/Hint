import { afterEach, describe, expect, it, vi } from "vitest";
const native = vi.hoisted(() => vi.fn(() => false));
vi.mock("./mobile/runtime", () => ({ isNativeShell: native }));
import { withIdentityLock } from "./identityLock";
afterEach(() => { vi.unstubAllGlobals(); native.mockReturnValue(false); });

describe("identity coordination capability", () => {
  it("uses the origin-wide exclusive lock when available", async () => {
    const request = vi.fn(async (_name, _options, work) => work());
    vi.stubGlobal("navigator", { locks: { request } });
    await expect(withIdentityLock(() => "saved")).resolves.toBe("saved");
    expect(request).toHaveBeenCalledWith("hint.identity-and-enrollment.v1", { mode: "exclusive" }, expect.any(Function));
  });
  it("does not execute an unsafe per-tab fallback in browsers without Web Locks", async () => {
    vi.stubGlobal("navigator", {});
    const work = vi.fn();
    await expect(withIdentityLock(work)).rejects.toThrow("coordination");
    expect(work).not.toHaveBeenCalled();
  });
  it("serializes native single-WebView work and continues after one operation fails", async () => {
    vi.stubGlobal("navigator", {}); native.mockReturnValue(true);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const order: string[] = [];
    const first = withIdentityLock(async () => { order.push("first"); await gate; throw new Error("storage"); });
    const rejected = expect(first).rejects.toThrow("storage");
    const second = withIdentityLock(() => { order.push("second"); return "saved"; });
    await Promise.resolve(); expect(order).toEqual(["first"]);
    release(); await rejected;
    await expect(second).resolves.toBe("saved"); expect(order).toEqual(["first", "second"]);
  });
});
