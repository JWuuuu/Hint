import { assertCurrentIdentity, captureIdentityContext, getAnonId } from "./identity";
import { withIdentityLock } from "./identityLock";
import { isNativeShell } from "./mobile/runtime";
import { createDeviceSessionManager, DeviceSessionError, type DeviceSession, type DeviceSessionFailure } from "./deviceSessionCore";

const managers = new Map<string, ReturnType<typeof createDeviceSessionManager>>();
const failures = new Map<string, DeviceSessionFailure | null>();
const EVENT = "hint:device-connection";
const base = () => (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const key = () => `hint_device_session_v1:${encodeURIComponent(base())}:${encodeURIComponent(getAnonId())}`;

async function nativeStore() {
  const { registerPlugin } = await import("@capacitor/core");
  return registerPlugin<{
    read: (args: { key: string }) => Promise<{ value: string | null }>;
    write: (args: { key: string; value: string }) => Promise<void>;
  }>("HintDeviceCredential");
}

function manager() {
  const namespace = key();
  const localOwner = getAnonId();
  let current = managers.get(namespace);
  if (!current) {
    current = createDeviceSessionManager({
      withLock: async work => withIdentityLock(async () => {
        assertCurrentIdentity(localOwner);
        const token = await work();
        assertCurrentIdentity(localOwner);
        return token;
      }),
      read: async () => {
        // A credential cannot be durable if its local namespace was never saved.
        const savedOwner = localStorage.getItem("hint_anon_id");
        if (savedOwner && savedOwner !== localOwner) throw new DeviceSessionError("storage");
        if (!savedOwner) localStorage.setItem("hint_anon_id", localOwner);
        if (localStorage.getItem("hint_anon_id") !== localOwner) throw new DeviceSessionError("storage");
        return isNativeShell() ? (await (await nativeStore()).read({ key: namespace })).value : localStorage.getItem(namespace);
      },
      write: async (value) => {
        if (isNativeShell()) await (await nativeStore()).write({ key: namespace, value });
        else {
          localStorage.setItem(namespace, value);
          if (localStorage.getItem(namespace) !== value) throw new DeviceSessionError("storage");
        }
      },
      enroll: async () => {
        const response = await fetch(`${base()}/api/device-sessions`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
          credentials: "omit", redirect: "error", signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new DeviceSessionError("unavailable");
        return await response.json() as DeviceSession;
      },
      onFailure: (reason) => {
        if (failures.get(namespace) === reason) return;
        failures.set(namespace, reason);
        window.dispatchEvent(new Event(EVENT));
      },
    });
    managers.set(namespace, current);
  }
  return current;
}

export const getDeviceSessionToken = async () => {
  const context = captureIdentityContext();
  const token = await manager().getToken();
  context.assertCurrent();
  return token;
};
export const invalidateDeviceSession = (token: string) => {
  for (const current of managers.values()) current.invalidate(token);
};
export const getDeviceSessionFailure = () => failures.get(key()) ?? null;
export function subscribeDeviceSession(listener: () => void) {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
