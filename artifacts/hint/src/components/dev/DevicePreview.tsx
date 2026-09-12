import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Smartphone } from "lucide-react";
import { isNativeShell } from "../../lib/mobile/runtime";
import "./device-preview.css";

const DEVICE_PREVIEW_PARAM = "hintPreview";
const DEVICE_STORAGE_KEY = "hint_dev_preview_device_v1";

type PreviewDevice = {
  id: string;
  label: string;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  cornerRadius: number;
  hasIsland: boolean;
};

const PREVIEW_DEVICES: PreviewDevice[] = [
  {
    id: "iphone-17-pro-max",
    label: "iPhone 17 Pro Max",
    width: 440,
    height: 956,
    safeTop: 59,
    safeBottom: 34,
    cornerRadius: 55,
    hasIsland: true,
  },
  {
    id: "iphone-17-pro",
    label: "iPhone 17 Pro",
    width: 402,
    height: 874,
    safeTop: 59,
    safeBottom: 34,
    cornerRadius: 52,
    hasIsland: true,
  },
  {
    id: "iphone-17",
    label: "iPhone 17",
    width: 402,
    height: 874,
    safeTop: 59,
    safeBottom: 34,
    cornerRadius: 52,
    hasIsland: true,
  },
  {
    id: "iphone-16-15",
    label: "iPhone 16 / 15",
    width: 393,
    height: 852,
    safeTop: 59,
    safeBottom: 34,
    cornerRadius: 50,
    hasIsland: true,
  },
  {
    id: "iphone-se",
    label: "iPhone SE",
    width: 375,
    height: 667,
    safeTop: 20,
    safeBottom: 0,
    cornerRadius: 36,
    hasIsland: false,
  },
];

function getInitialDeviceId() {
  try {
    const saved = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (PREVIEW_DEVICES.some((device) => device.id === saved)) return saved!;
  } catch {
    // Storage can be unavailable in private browsing.
  }
  return PREVIEW_DEVICES[0]!.id;
}

function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function getEmbeddedUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set(DEVICE_PREVIEW_PARAM, "embedded");
  return `${url.pathname}${url.search}${url.hash}`;
}

export function shouldShowDevicePreview() {
  if (isNativeShell() || window.self !== window.top) return false;
  const mode = new URLSearchParams(window.location.search).get(DEVICE_PREVIEW_PARAM);
  return mode !== "embedded" && (import.meta.env.DEV || mode === "frame");
}

export function DevicePreview() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [deviceId, setDeviceId] = useState(getInitialDeviceId);
  const [viewport, setViewport] = useState(getViewportSize);
  const device = PREVIEW_DEVICES.find((item) => item.id === deviceId) ?? PREVIEW_DEVICES[0]!;
  const embeddedUrl = useMemo(getEmbeddedUrl, []);

  useEffect(() => {
    const updateViewport = () => setViewport(getViewportSize());
    window.addEventListener("resize", updateViewport, { passive: true });
    window.visualViewport?.addEventListener("resize", updateViewport, { passive: true });
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEVICE_STORAGE_KEY, device.id);
    } catch {
      // Storage can be unavailable in private browsing.
    }
  }, [device.id]);

  const applySafeAreas = () => {
    const root = iframeRef.current?.contentDocument?.documentElement;
    if (!root) return;
    root.style.setProperty("--hint-safe-top", `${device.safeTop}px`);
    root.style.setProperty("--hint-safe-bottom", `${device.safeBottom}px`);
    root.style.setProperty("--hint-safe-left", "0px");
    root.style.setProperty("--hint-safe-right", "0px");
  };

  useEffect(applySafeAreas, [device]);

  const frameWidth = device.width + 14;
  const frameHeight = device.height + 14;
  const availableWidth = Math.max(280, viewport.width - 32);
  const availableHeight = Math.max(420, viewport.height - 92);
  const scale = Math.min(1, availableWidth / frameWidth, availableHeight / frameHeight);

  return (
    <main className="hint-preview-workspace">
      <div className="hint-preview-toolbar">
        <span className="hint-preview-toolbar__icon" aria-hidden="true">
          <Smartphone size={17} strokeWidth={1.8} />
        </span>
        <label className="hint-preview-device-field">
          <span className="sr-only">Preview device</span>
          <select value={device.id} onChange={(event) => setDeviceId(event.target.value)}>
            {PREVIEW_DEVICES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <ChevronDown size={15} strokeWidth={2} aria-hidden="true" />
        </label>
        <span className="hint-preview-dimensions">
          {device.width} × {device.height}
        </span>
      </div>

      <div
        className="hint-preview-scaled-frame"
        style={{ width: frameWidth * scale, height: frameHeight * scale }}
      >
        <div
          className="hint-preview-phone"
          data-has-island={device.hasIsland ? "true" : "false"}
          style={{
            width: frameWidth,
            height: frameHeight,
            borderRadius: device.cornerRadius + 7,
            transform: `scale(${scale})`,
          }}
        >
          <iframe
            ref={iframeRef}
            title={`${device.label} preview`}
            src={embeddedUrl}
            className="hint-preview-screen"
            style={{
              width: device.width,
              height: device.height,
              borderRadius: device.cornerRadius,
            }}
            onLoad={applySafeAreas}
          />

          <div className="hint-preview-hardware" aria-hidden="true">
            {device.hasIsland ? (
              <span className="hint-preview-island">
                <span className="hint-preview-camera" />
              </span>
            ) : (
              <span className="hint-preview-earpiece" />
            )}
            {device.safeBottom > 0 ? <span className="hint-preview-home-indicator" /> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
