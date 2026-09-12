import { isNativeShell } from "./mobile/runtime";

export function validatePublicUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search ||
      !host.includes(".") || /(^|\.)(localhost|local|test|invalid|example)(\.|$)/.test(host) ||
      /(^|\.)example\.(com|org|net)$/.test(host) || /placeholder|your[-.]|changeme/.test(host) ||
      /^[\d.]+$/.test(host) || host.includes(":")) throw new Error("A public HTTPS address is required");
  return url;
}

export function publicAppUrl(path: `/app${string}` = "/app"): string {
  if (!/^\/app(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(path)) throw new Error("Invalid public app path");
  const configured = import.meta.env.VITE_HINT_PUBLIC_URL?.trim();
  if (configured) {
    const base = validatePublicUrl(configured);
    return `${base.href.replace(/\/$/, "")}${path}`;
  }
  // A local preview may render an inspectable image, but never exports a native origin.
  if (!isNativeShell() && typeof window !== "undefined" &&
      (import.meta.env.DEV || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname))) {
    return `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}${path}`;
  }
  throw new Error("Public sharing is not configured");
}

export function hintDownloadUrl(): string {
  const configured = import.meta.env.VITE_HINT_DOWNLOAD_URL?.trim();
  return configured ? validatePublicUrl(configured).href : publicAppUrl("/app");
}

/** Universal links carry only an allowlisted route and an opaque invitation token. */
export function parseHintUniversalLink(value: string, publicBase = import.meta.env.VITE_HINT_PUBLIC_URL): string | null {
  if (!publicBase) return null;
  try {
    const base = validatePublicUrl(publicBase);
    const target = new URL(value);
    if (target.origin !== base.origin || target.username || target.password || target.search || target.hash) return null;
    const prefix = base.pathname.replace(/\/$/, "");
    if (!target.pathname.startsWith(`${prefix}/app/compatibility/invite/`)) return null;
    const path = target.pathname.slice(prefix.length);
    return /^\/app\/compatibility\/invite\/[A-Za-z0-9_-]{16,128}\/?$/.test(path) ? path.replace(/\/$/, "") : null;
  } catch { return null; }
}
