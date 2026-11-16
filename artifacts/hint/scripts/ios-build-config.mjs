import { loadEnv } from "vite";
import { publicHttps } from "./release-config.mjs";

/** Match mobile:build's env-file precedence without requiring CI's packaged web URLs. */
export function resolveIosAssociatedDomain(root, environment = process.env) {
  const env = { ...loadEnv("mobile", root, ""), ...environment };
  const domain = env.HINT_ASSOCIATED_DOMAIN;
  if (!domain) throw new Error("HINT_ASSOCIATED_DOMAIN is required for the iOS build");
  const url = publicHttps(`https://${domain}`, "HINT_ASSOCIATED_DOMAIN");
  if (url.hostname !== domain || url.port || url.pathname !== "/") {
    throw new Error("HINT_ASSOCIATED_DOMAIN must be a public hostname without a scheme, port or path");
  }
  if (env.VITE_HINT_PUBLIC_URL && publicHttps(env.VITE_HINT_PUBLIC_URL, "VITE_HINT_PUBLIC_URL").hostname !== domain) {
    throw new Error("HINT_ASSOCIATED_DOMAIN must match VITE_HINT_PUBLIC_URL hostname");
  }
  return domain;
}
