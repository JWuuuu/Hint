import { defineConfig } from "@playwright/test";
import { microphoneWav } from "./e2e-voice/fakeAudio";

/**
 * Real-browser voice checks: Chromium with a fake microphone exercises
 * MediaRecorder, the silence detector, the /api/transcribe upload and spoken
 * replies. API responses are mocked; no live service is reached.
 *   pnpm --filter @workspace/hint run test:e2e:voice
 * Set HINT_CHROMIUM_PATH to use an already-installed Chromium.
 */
const baseURL = "http://127.0.0.1:5182";

export default defineConfig({
  testDir: "./e2e-voice",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [["list"]],
  outputDir: "./test-results/voice",
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 440, height: 956 },
    hasTouch: true,
    isMobile: true,
    locale: "en-US",
    permissions: ["microphone"],
    launchOptions: {
      ...(process.env.HINT_CHROMIUM_PATH ? { executablePath: process.env.HINT_CHROMIUM_PATH } : {}),
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${microphoneWav}`,
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "HINT_TAROT_E2E=1 PORT=5182 pnpm run dev",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
