import { loadEnv } from "vite";
import { validateReleaseConfig } from "./release-config.mjs";

try {
  const env = { ...loadEnv(process.argv[2] || "mobile", process.cwd(), ""), ...process.env };
  validateReleaseConfig(env);
  console.log("Mobile public URL and associated-domain configuration passed.");
} catch (error) {
  console.error(`Mobile build blocked: ${error.message}`);
  process.exit(1);
}
