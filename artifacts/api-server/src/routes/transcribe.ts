import { raw, Router, type Request } from "express";
import { toFile } from "openai";
import { getOpenAIClient, openaiTranscribeModel } from "../lib/openaiConfig.js";
import { consumeAiBudget } from "../lib/aiCostGuards.js";
import { logger } from "../lib/logger.js";

/**
 * Server speech-to-text for clients that cannot recognise speech on the device:
 * Android WebViews, Firefox and other browsers without the Web Speech API.
 * The client records one spoken turn and uploads the raw audio body.
 */
const router = Router();

// One spoken turn is capped at 30 s on the client; 6 MB leaves room for
// uncompressed fallbacks while keeping abuse bounded.
export const MAX_TRANSCRIBE_BYTES = 6 * 1024 * 1024;
const MIN_TRANSCRIBE_BYTES = 512;

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
const LANGUAGES = new Set(["en", "zh", "es", "ja", "ko"]);

function audioType(req: Request): string {
  return String(req.headers["content-type"] ?? "").split(";")[0]!.trim().toLowerCase();
}

router.post(
  "/transcribe",
  raw({ type: (req) => audioType(req as Request) in AUDIO_EXTENSIONS, limit: MAX_TRANSCRIBE_BYTES }),
  async (req, res) => {
    const type = audioType(req);
    const extension = AUDIO_EXTENSIONS[type];
    if (!extension) {
      res.status(415).json({ error: "Unsupported audio format.", code: "UNSUPPORTED_AUDIO" });
      return;
    }
    const audio: unknown = req.body;
    if (!Buffer.isBuffer(audio) || audio.byteLength < MIN_TRANSCRIBE_BYTES) {
      res.status(400).json({ error: "The recording was empty.", code: "EMPTY_AUDIO" });
      return;
    }
    const requested = typeof req.query.language === "string" ? req.query.language.slice(0, 2).toLowerCase() : "";
    const language = LANGUAGES.has(requested) ? requested : undefined;

    if (!await consumeAiBudget(req, res, { feature: "transcribe", dailyLimit: 40 })) {
      return;
    }

    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.once("close", cancel);

    try {
      const result = await getOpenAIClient().audio.transcriptions.create(
        {
          file: await toFile(audio, `speech.${extension}`, { type }),
          model: openaiTranscribeModel,
          ...(language ? { language } : {}),
          response_format: "json",
        },
        { signal: controller.signal },
      );
      if (res.destroyed) return;
      res.set("Cache-Control", "no-store").json({ text: result.text.trim() });
    } catch (err) {
      if (controller.signal.aborted || res.destroyed) return;
      logger.error({ err }, "Failed to transcribe speech");
      res.status(502).json({ error: "Voice input is unavailable right now.", code: "TRANSCRIPTION_UNAVAILABLE" });
    } finally {
      res.off("close", cancel);
    }
  },
);

export default router;
