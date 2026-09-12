import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv } from "vite";
import { validateReleaseConfig } from "./release-config.mjs";

const env = { ...loadEnv("mobile", process.cwd(), ""), ...process.env };
const config = validateReleaseConfig(env);
const output = resolve(process.argv[2] || "dist/universal-links");
mkdirSync(resolve(output, ".well-known"), { recursive: true });
const path = `${config.app.pathname.replace(/\/$/, "")}/app/compatibility/invite/*`;
writeFileSync(resolve(output, ".well-known/apple-app-site-association"), JSON.stringify({
  applinks: { details: [{ appIDs: [`${config.teamId}.com.mydailyhint.app`], components: [{ "/": path }] }] },
}, null, 2));
writeFileSync(resolve(output, "hosting-instructions.txt"), [
  "Serve .well-known/apple-app-site-association at the domain root over HTTPS without redirects, with Content-Type application/json.",
  `Domain: ${config.app.hostname}`,
  `Invitation path: ${path}`,
  "Do not cache or log invitation tokens. Serve the installation landing page for browser invitation requests; never fetch private birth data for that page.",
].join("\n"));
console.log(`Prepared universal-link association for ${config.app.hostname}; nothing has been published.`);
