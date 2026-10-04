import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";
import path from "path";

const rawPort = process.env.PORT ?? "5173";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? "/";
const isTarotE2E = process.env.HINT_TAROT_E2E === "1";

const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://localhost:5050";

function copyTarotDeckAssets() {
  let publicDir = "";
  let outDir = "";

  return {
    name: "copy-tarot-deck-assets",
    configResolved(config: { publicDir: string; build: { outDir: string } }) {
      publicDir = config.publicDir;
      outDir = config.build.outDir;
    },
    closeBundle() {
      // Static hosting can resolve direct /app child routes with the same built shell.
      const index = path.resolve(outDir, "index.html");
      if (fs.existsSync(index)) fs.copyFileSync(index, path.resolve(outDir, "404.html"));
      const source = path.resolve(publicDir, "brand/tarot/decks");
      const destination = path.resolve(outDir, "brand/tarot/decks");
      if (!fs.existsSync(source)) return;
      fs.rmSync(destination, { recursive: true, force: true });
      fs.cpSync(source, destination, { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  base: basePath,
  // Keep the test server's dependency rebuilds separate from the live phone preview.
  cacheDir: isTarotE2E ? path.resolve(import.meta.dirname, "node_modules/.vite-tarot-e2e") : undefined,
  plugins: [react(), tailwindcss(), copyTarotDeckAssets()],
  optimizeDeps: {
    entries: ["index.html"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    // The Tailwind 4 interface requires the WebKit shipped with iOS 16.4.
    target: ["es2022", "safari16.4"],
    cssTarget: "safari16.4",
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    hmr: isTarotE2E ? false : undefined,
    watch: isTarotE2E ? null : {
      // Capacitor copies and test evidence are outputs, not live web source.
      ignored: ["**/ios/**", "**/android/**", "**/test-results/**", "**/e2e/__screenshots__/**"],
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
