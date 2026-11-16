// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  read: vi.fn<(args: { key: string }) => Promise<{ value: string | null }>>(),
  write: vi.fn<(args: { key: string; value: string }) => Promise<void>>(),
  thenProbe: vi.fn(),
}));
vi.mock("./mobile/runtime", () => ({ isNativeShell: () => true }));
vi.mock("@capacitor/core", () => ({
  // Capacitor's plugin proxy exposes arbitrary properties as native methods,
  // including `then`. A plain object mock cannot catch Promise assimilation.
  registerPlugin: () => new Proxy({}, {
    get(_target, property) {
      if (property === "then") {
        native.thenProbe();
        throw new Error("Unsupported native plugin then() assimilation");
      }
      if (property === "read") return native.read;
      if (property === "write") return native.write;
      throw new Error(`Unexpected native method ${String(property)}`);
    },
  }),
}));

const key = "hint_device_session_v1::native-fixture-owner";
const credential = { token: "n".repeat(64), ownerId: "fixture-server-owner", expiresAt: "2099-01-01T00:00:00Z" };
const encoded = JSON.stringify(credential);
let stored: string | null;
const enroll = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules(); vi.stubGlobal("navigator", {}); vi.stubGlobal("fetch", enroll);
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem("hint_anon_id", "native-fixture-owner");
  stored = encoded; native.thenProbe.mockClear(); native.read.mockReset(); native.write.mockReset(); enroll.mockReset();
  native.read.mockImplementation(async () => ({ value: stored }));
  native.write.mockImplementation(async ({ value }) => { stored = value; });
  enroll.mockResolvedValue(new Response(encoded, { status: 201, headers: { "Content-Type": "application/json" } }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("reads the native credential without assimilating the plugin proxy or enrolling again", async () => {
  const session = await import("./deviceSession");
  expect(await session.getDeviceSessionToken()).toBe(credential.token);
  expect(native.read).toHaveBeenCalledWith({ key });
  expect(native.thenProbe).not.toHaveBeenCalled(); expect(native.write).not.toHaveBeenCalled(); expect(enroll).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBeNull(); expect(stored).toBe(encoded);
});

it("waits for the native write before authorizing a newly enrolled session and reuses that credential", async () => {
  stored = null;
  let finish!: () => void;
  native.write.mockImplementation(({ value }) => new Promise(resolve => { finish = () => { stored = value; resolve(); }; }));
  const session = await import("./deviceSession");
  let returned = false;
  const first = session.getDeviceSessionToken().then(token => { returned = true; return { value: token }; }, error => ({ error }));
  await vi.waitFor(() => expect(native.write).toHaveBeenCalledOnce());
  expect(native.write).toHaveBeenCalledWith({ key, value: encoded });
  expect(returned).toBe(false); expect(stored).toBeNull();
  finish(); expect(await first).toEqual({ value: credential.token });
  expect(await session.getDeviceSessionToken()).toBe(credential.token);
  expect(enroll).toHaveBeenCalledOnce(); expect(native.write).toHaveBeenCalledOnce();
  expect(native.thenProbe).not.toHaveBeenCalled(); expect(localStorage.getItem(key)).toBeNull();
});

it("fails closed on native read rejection even when a browser credential exists", async () => {
  localStorage.setItem(key, encoded);
  native.read.mockRejectedValue(new Error("fixture unavailable store"));
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "storage" });
  expect(native.read).toHaveBeenCalledOnce(); expect(session.getDeviceSessionFailure()).toBe("storage");
  expect(enroll).not.toHaveBeenCalled(); expect(native.write).not.toHaveBeenCalled();
  expect(localStorage.getItem(key)).toBe(encoded); expect(stored).toBe(encoded);
});

it("does not authorize a failed write; a deliberate storage retry keeps the same enrollment", async () => {
  stored = null; native.write.mockRejectedValueOnce(new Error("fixture write rejected"));
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "storage" });
  expect(stored).toBeNull(); expect(enroll).toHaveBeenCalledOnce();
  expect(await session.getDeviceSessionToken()).toBe(credential.token);
  expect(enroll).toHaveBeenCalledOnce(); expect(native.write).toHaveBeenCalledTimes(2);
  expect(native.write.mock.calls.map(([args]) => args)).toEqual([{ key, value: encoded }, { key, value: encoded }]);
  expect(session.getDeviceSessionFailure()).toBeNull(); expect(native.thenProbe).not.toHaveBeenCalled();
});

it.each([
  ["malformed", "not-json", "storage"],
  ["expired", JSON.stringify({ ...credential, expiresAt: "2000-01-01T00:00:00Z" }), "expired"],
])("does not replace a %s native credential", async (_label, value, reason) => {
  stored = value;
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason });
  expect(native.read).toHaveBeenCalledOnce(); expect(enroll).not.toHaveBeenCalled(); expect(native.write).not.toHaveBeenCalled();
  expect(stored).toBe(value);
});

it("keeps revoked credentials revoked without reenrolling", async () => {
  const session = await import("./deviceSession");
  const token = await session.getDeviceSessionToken(); session.invalidateDeviceSession(token);
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "revoked" });
  expect(enroll).not.toHaveBeenCalled(); expect(native.write).not.toHaveBeenCalled(); expect(stored).toBe(encoded);
});

it("rejects late native read completion after identity changes", async () => {
  let finish!: (value: { value: string | null }) => void;
  native.read.mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const session = await import("./deviceSession");
  const result = session.getDeviceSessionToken();
  const observed = result.then(value => ({ value }), error => ({ error }));
  await vi.waitFor(() => expect(native.read).toHaveBeenCalledOnce());
  localStorage.setItem("hint_anon_id", "another-fixture-owner"); finish({ value: encoded });
  expect(await observed).toMatchObject({ error: { name: "AbortError" } });
  expect(enroll).not.toHaveBeenCalled(); expect(native.write).not.toHaveBeenCalled();
  expect(stored).toBe(encoded);
});

it("preserves cancellation errors from the native read without fallback or enrollment", async () => {
  native.read.mockRejectedValue(new DOMException("fixture cancellation", "AbortError"));
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ name: "AbortError" });
  expect(native.read).toHaveBeenCalledOnce(); expect(enroll).not.toHaveBeenCalled(); expect(native.write).not.toHaveBeenCalled();
  expect(session.getDeviceSessionFailure()).toBeNull();
});

it("does not write or authorize when enrollment is refused", async () => {
  stored = null; enroll.mockResolvedValue(new Response(JSON.stringify({ code: "INVITE_REQUIRED" }), { status: 403 }));
  const session = await import("./deviceSession");
  await expect(session.getDeviceSessionToken()).rejects.toMatchObject({ reason: "invite" });
  expect(native.read).toHaveBeenCalledOnce(); expect(native.write).not.toHaveBeenCalled(); expect(stored).toBeNull();
});
