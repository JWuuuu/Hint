export function publicHttps(value, label) {
  if (!value?.trim()) throw new Error(`${label} is required`);
  const url = new URL(value.trim());
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !host.includes(".") || /(^|\.)(localhost|local|test|invalid|example)(\.|$)/.test(host) ||
      /(^|\.)example\.(com|org|net)$/.test(host) || /placeholder|your[-.]|changeme/.test(host) ||
      /^[\d.]+$/.test(host) || host.includes(":")) throw new Error(`${label} must be a real public HTTPS URL`);
  return url;
}
export function validateReleaseConfig(env) {
  const api = publicHttps(env.VITE_API_BASE_URL, "VITE_API_BASE_URL");
  const app = publicHttps(env.VITE_HINT_PUBLIC_URL, "VITE_HINT_PUBLIC_URL");
  const download = publicHttps(env.VITE_HINT_DOWNLOAD_URL, "VITE_HINT_DOWNLOAD_URL");
  if (app.pathname.replace(/\/$/, "").endsWith("/app")) throw new Error("VITE_HINT_PUBLIC_URL must be the hosting base before /app");
  if (!/^[A-Z0-9]{10}$/.test(env.HINT_APPLE_TEAM_ID ?? "")) throw new Error("HINT_APPLE_TEAM_ID must be the 10-character Apple application identifier prefix");
  if (env.HINT_ASSOCIATED_DOMAIN !== app.hostname) throw new Error("HINT_ASSOCIATED_DOMAIN must match VITE_HINT_PUBLIC_URL hostname");
  return { api, app, download, teamId: env.HINT_APPLE_TEAM_ID };
}
