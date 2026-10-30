import { Router, raw, type Request, type RequestHandler } from "express";
import { toFile } from "openai";
import * as z from "zod";
import {
  getOpenAIClient,
  openaiTtsModel,
  openaiTtsVoice,
  openaiApiKey,
  openaiTranscriptionModel,
} from "../lib/openaiConfig.js";
import { consumeAiBudget } from "../lib/aiCostGuards.js";

const router = Router();

router.get("/speech/transcription/status", (_req, res) => {
  res.set("Cache-Control", "no-store").json({ available: Boolean(openaiApiKey) });
});

const audioTypes: Record<string, string> = {
  "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
  "audio/aac": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
};
const audioType = (req: Request) => req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
const supportedAudio = (mime: string) => Object.hasOwn(audioTypes, mime);
const transcription: RequestHandler[] = [raw({ type: req => supportedAudio(audioType(req as Request)), limit: "4mb" }), async (req, res) => {
  const mime = audioType(req);
  if (!supportedAudio(mime)) { res.status(415).json({ error: "Unsupported audio format.", code: "UNSUPPORTED_AUDIO" }); return; }
  if (!Buffer.isBuffer(req.body) || !req.body.length) { res.status(400).json({ error: "The recording was empty.", code: "EMPTY_AUDIO" }); return; }
  // Region tags (en-US) arrive from native shells and d1fbcf8 clients.
  const language = typeof req.query.language === "string" ? req.query.language.split("-")[0]!.toLowerCase() : "en";
  if (!["en", "zh", "es", "ja", "ko"].includes(language)) { res.status(400).json({ error: "Unsupported language.", code: "UNSUPPORTED_LANGUAGE" }); return; }
  if (!openaiApiKey) { res.status(503).json({ error: "Voice transcription is not configured.", code: "SPEECH_UNAVAILABLE" }); return; }
  if (!await consumeAiBudget(req, res, { feature: "transcription", dailyLimit: 30 })) return;
  const abort = new AbortController();
  const disconnect = () => { if (!res.writableEnded) abort.abort(); };
  res.once("close", disconnect);
  try {
    const result = await getOpenAIClient().audio.transcriptions.create({
      model: openaiTranscriptionModel,
      file: await toFile(req.body, `voice.${audioTypes[mime]}`, { type: mime }),
      language, response_format: "json",
    }, { signal: abort.signal });
    if (!abort.signal.aborted && !res.destroyed) res.set("Cache-Control", "no-store").json({ text: result.text.trim() });
  } catch (error) {
    // A disconnected client needs no reply; provider failures go to the shared errorHandler (502/429).
    if (abort.signal.aborted || res.destroyed) return;
    throw error;
  } finally { res.off("close", disconnect); }
}];
router.post("/speech/transcription", ...transcription);
// Compatibility alias for builds from d1fbcf8, which upload to /api/transcribe; same handler and budget.
router.post("/transcribe", ...transcription);

const speechInputSchema = z.object({
  text: z.string().trim().min(1).max(4096),
});

router.post("/speech", async (req, res) => {
  const parsed = speechInputSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  if (!await consumeAiBudget(req, res, { feature: "speech", dailyLimit: 10 })) {
    return;
  }

  const speech = await getOpenAIClient().audio.speech.create({
    model: openaiTtsModel,
    voice: openaiTtsVoice,
    input: parsed.data.text,
    instructions:
      "Speak in a calm, intimate, grounded tone. Keep the delivery warm and unhurried.",
    response_format: "mp3",
  });

  const audio = Buffer.from(await speech.arrayBuffer());

  res
    .status(200)
    .set({
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      "Cache-Control": "no-store",
    })
    .send(audio);
});

export default router;
