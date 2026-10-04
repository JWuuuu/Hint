export function allowedOrigin(origin: string | undefined) {
  if (!origin) return true; // Native clients and server-to-server requests still require device credentials.
  const configured = (process.env.HINT_ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
  if (["capacitor://localhost", "https://localhost", ...configured].includes(origin)) return true;
  if (process.env.NODE_ENV === "production") return false;
  try { const url = new URL(origin); return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname); }
  catch { return false; }
}
