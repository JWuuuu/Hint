import { createRequestLifetime, setAuthFailureHandler, setAuthTokenGetter, setBaseUrl, setRequestIdentityGetter } from "@workspace/api-client-react";
import { isNativeShell } from "./mobile";
import { getDeviceSessionToken, invalidateDeviceSession } from "./deviceSession";
import { captureIdentityContext, startIdentityCoordination } from "./identity";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ?? "";

export function configureApiClient() {
  setBaseUrl(apiBaseUrl || null);
  setAuthTokenGetter(getDeviceSessionToken);
  setAuthFailureHandler(invalidateDeviceSession);
  setRequestIdentityGetter(captureIdentityContext);
  startIdentityCoordination();

  if (isNativeShell() && !apiBaseUrl) {
    console.warn(
      "Hint native build is missing VITE_API_BASE_URL. API-backed features need a deployed API URL in mobile builds.",
    );
  }
}

export function apiUrl(path: `/${string}`) {
  return `${apiBaseUrl}${path}`;
}

/** Only the configured API can receive this installation's credential. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const expected = new URL(apiBaseUrl || "/", window.location.href);
  const target = new URL(input, window.location.href);
  const prefix = `${expected.pathname.replace(/\/$/, "")}/api/`;
  if (target.origin !== expected.origin || target.protocol !== expected.protocol || target.host !== expected.host ||
      target.username || target.password || !target.pathname.startsWith(prefix)) throw new Error("Invalid API destination");
  init.signal?.throwIfAborted();
  const identity = captureIdentityContext();
  const { signal, dispose, waitFor } = createRequestLifetime(init.signal, identity.signal);
  try {
    signal.throwIfAborted(); identity.assertCurrent();
    const token = await waitFor(getDeviceSessionToken());
    signal?.throwIfAborted(); identity.assertCurrent();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const response = await waitFor(fetch(input, { ...init, signal, headers, credentials: "omit", redirect: "error" }));
    signal?.throwIfAborted(); identity.assertCurrent();
    if (response.status === 401) invalidateDeviceSession(token);
    // Current direct API callers consume complete JSON or audio bodies. Finish
    // that body under the owner fence so a late body cannot populate new state.
    // WebKit can expose an empty stream for a bodyless network response. The
    // Response constructor still requires null for these HTTP statuses.
    const bodyless = init.method?.toUpperCase() === "HEAD" || [204, 205, 304].includes(response.status);
    const body = bodyless || response.body === null ? null : await waitFor(response.arrayBuffer());
    signal?.throwIfAborted(); identity.assertCurrent();
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } finally { dispose(); }
}
