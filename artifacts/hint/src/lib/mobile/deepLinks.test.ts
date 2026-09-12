import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isNativeShell: vi.fn(),
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  remove: vi.fn(async () => undefined),
}));

vi.mock("./runtime", () => ({ isNativeShell: mocks.isNativeShell }));
vi.mock("@capacitor/app", () => ({
  App: { addListener: mocks.addListener, getLaunchUrl: mocks.getLaunchUrl },
}));

import { configureNativeDeepLinks } from "./deepLinks";

const publicBase = "https://mydailyhint.com/Hint";
const firstRoute = "/app/compatibility/invite/abcdefghijklmnop";
const secondRoute = "/app/compatibility/invite/qrstuvwxyz012345";

describe("native invitation deep links", () => {
  const location = { pathname: "/app" };
  const pushState = vi.fn((_state: unknown, _title: string, destination: string) => {
    location.pathname = destination;
  });
  const dispatchEvent = vi.fn();

  function warmLink(url: string) {
    const listener = mocks.addListener.mock.calls[0]?.[1] as (event: { url: string }) => void;
    expect(listener).toBeTypeOf("function");
    listener({ url });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    location.pathname = "/app";
    mocks.isNativeShell.mockReturnValue(true);
    mocks.addListener.mockResolvedValue({ remove: mocks.remove });
    mocks.getLaunchUrl.mockResolvedValue(undefined);
    vi.stubEnv("BASE_URL", "/");
    vi.stubEnv("VITE_HINT_PUBLIC_URL", publicBase);
    vi.stubGlobal("window", { location, history: { pushState }, dispatchEvent });
    vi.stubGlobal("PopStateEvent", class extends Event {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("opens an allowed cold-launch invitation and notifies the router", async () => {
    mocks.getLaunchUrl.mockResolvedValue({ url: publicBase + firstRoute });

    const cleanup = await configureNativeDeepLinks();

    expect(mocks.addListener).toHaveBeenCalledWith("appUrlOpen", expect.any(Function));
    expect(pushState).toHaveBeenCalledExactlyOnceWith(null, "", firstRoute);
    expect(dispatchEvent).toHaveBeenCalledOnce();
    expect(dispatchEvent.mock.calls[0][0].type).toBe("popstate");
    await cleanup();
  });

  it("opens a warm invitation after launch without duplicating the current route", async () => {
    const cleanup = await configureNativeDeepLinks();
    expect(pushState).not.toHaveBeenCalled();

    warmLink(publicBase + firstRoute);
    warmLink(publicBase + firstRoute);
    warmLink(publicBase + secondRoute);

    expect(pushState.mock.calls.map(call => call[2])).toEqual([firstRoute, secondRoute]);
    expect(dispatchEvent).toHaveBeenCalledTimes(2);
    await cleanup();
  });
  it("does not let a late cold-launch response replace a newer warm invitation", async () => {
    let resolveLaunch!: (value: { url: string }) => void;
    mocks.getLaunchUrl.mockImplementation(() => new Promise(resolve => { resolveLaunch = resolve; }));
    const setup = configureNativeDeepLinks();
    await vi.waitFor(() => expect(mocks.getLaunchUrl).toHaveBeenCalled());
    warmLink(publicBase + secondRoute);
    resolveLaunch({ url: publicBase + firstRoute });
    const cleanup = await setup;
    expect(pushState.mock.calls.map(call => call[2])).toEqual([secondRoute]);
    await cleanup();
  });

  it.each([
    "https://unrelated.com/Hint" + firstRoute,
    publicBase + "/app/profile",
    publicBase + firstRoute + "?next=/app/profile",
    publicBase + "/app/compatibility/invite/%2Fbad",
  ])("ignores disallowed cold and warm links: %s", async url => {
    mocks.getLaunchUrl.mockResolvedValue({ url });
    const cleanup = await configureNativeDeepLinks();

    warmLink(url);

    expect(pushState).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
    await cleanup();
  });

  it("preserves the app's hosted BASE path independently of the public link prefix", async () => {
    vi.stubEnv("BASE_URL", "/beta/");
    mocks.getLaunchUrl.mockResolvedValue({ url: publicBase + firstRoute });
    const cleanup = await configureNativeDeepLinks();

    warmLink(publicBase + secondRoute);

    expect(pushState.mock.calls.map(call => call[2])).toEqual([
      `/beta${firstRoute}`,
      `/beta${secondRoute}`,
    ]);
    await cleanup();
  });

  it("retains the warm listener when cold-launch lookup fails", async () => {
    mocks.getLaunchUrl.mockRejectedValue(new Error("Launch URL unavailable"));
    const cleanup = await configureNativeDeepLinks();

    warmLink(publicBase + firstRoute);

    expect(pushState).toHaveBeenCalledExactlyOnceWith(null, "", firstRoute);
    expect(mocks.remove).not.toHaveBeenCalled();
    await cleanup();
  });

  it("removes its listener and ignores a queued native event after cleanup", async () => {
    const cleanup = await configureNativeDeepLinks();

    await cleanup();
    warmLink(publicBase + firstRoute);

    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(pushState).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it("does not access native link APIs in the browser", async () => {
    mocks.isNativeShell.mockReturnValue(false);

    const cleanup = await configureNativeDeepLinks();
    await cleanup();

    expect(mocks.addListener).not.toHaveBeenCalled();
    expect(mocks.getLaunchUrl).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
  });
});
