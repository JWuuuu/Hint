import { InviteError, createCompatibilityInvite, findCompatibilityInvite, publicCompatibilityInvite, completeCompatibilityInvite, readCompatibilityResult } from "../modules/astrology/compatibilityStore.js";
import { birthDetailsError } from "@workspace/api-zod";
import { authenticatedOwner } from "../lib/deviceSession";
import { consumeAiBudget } from "../lib/aiCostGuards";
import crypto from "node:crypto";
import { Router } from "express";
import * as z from "zod";
import {
  getAstroInterpretationProxy,
  getAstroProxyStatus,
  getGeoDetailsProxy,
  getNasaApodProxy,
  getNatalProxy,
  getSynastryProxy,
  getTimezoneProxy,
  getTransitsProxy,
} from "../modules/astrology/astroProxyService.js";
import {
  buildCompatibilityResult,
  calculateBirthChart,
  getAstrologyStatus,
  type BirthProfileInput,
  type CompatibilityResult,
} from "../modules/astrology/astrologyApiClient.js";

const router = Router();
router.use(async (req, res, next) => {
  const isProviderRoute = req.method === "POST" && ["/astro/geo-details", "/astro/timezone", "/astro/natal", "/astro/transits", "/astro/synastry", "/astrology/birth-chart", "/astrology/recalculate-chart", "/ai/astro-interpretation"].includes(req.path) || req.method === "GET" && req.path === "/visual/nasa/apod";
  if (isProviderRoute && !await consumeAiBudget(req, res, { feature: "astrology", dailyLimit: 30, maxRequestsPerWindow: 15 })) return;
  next();
});

const birthProfileSchema = z.object({
  userId: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(120).optional(),
  birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().max(40).optional(),
  birthCity: z.string().max(200).optional(),
  birthCountry: z.string().max(120).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.union([z.string().max(80), z.number().min(-12).max(14)]).optional(),
}).refine(input => !birthDetailsError({ ...input, birthDate: input.birthday, timezone: typeof input.timezone === "string" ? input.timezone : undefined, timezoneOffset: typeof input.timezone === "number" ? input.timezone : undefined }), "Invalid birth details");

const astroProfileSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(120).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().max(40).optional(),
  birthPlace: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().max(80).optional(),
  timezoneOffset: z.number().min(-12).max(14).optional(),
}).refine(input => !birthDetailsError(input), "Invalid birth details");

const natalProxySchema = z.object({
  profile: astroProfileSchema,
});

const transitsProxySchema = z.object({
  profile: astroProfileSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const synastryProxySchema = z.object({
  userProfile: astroProfileSchema,
  partnerProfile: astroProfileSchema,
});

const geoDetailsSchema = z.object({
  place: z.string().min(1).max(160),
  maxRows: z.number().int().min(1).max(12).optional(),
});

const timezoneSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const interpretationSchema = z.object({
  kind: z.enum(["placement", "signs", "transit", "synastry", "reportPreview"]),
  data: z.record(z.string(), z.unknown()),
  tone: z.enum(["warm", "direct", "mirror"]).optional(),
});

const inviteSchema = z.object({
  createdByUserId: z.string().min(1).max(200),
  relationshipType: z.enum(["crush", "partner", "ex", "friend", "unclear"]).optional(),
  birthProfile: birthProfileSchema,
});

const inviteCompletionSchema = z.object({
  friendName: z.string().min(1).max(120).optional(),
  friendBirthProfile: birthProfileSchema,
  consent: z.boolean(),
});

router.get("/astrology/status", (_req, res) => {
  res.json(getAstrologyStatus());
});

router.get("/astro/status", (_req, res) => {
  res.json(getAstroProxyStatus());
});

router.post("/astro/geo-details", async (req, res) => {
  const parsed = geoDetailsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid location search." });
    return;
  }

  res.json(await getGeoDetailsProxy(parsed.data.place, parsed.data.maxRows));
});

router.post("/astro/timezone", async (req, res) => {
  const parsed = timezoneSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid timezone request." });
    return;
  }

  res.json(await getTimezoneProxy(parsed.data.latitude, parsed.data.longitude, parsed.data.dateISO ?? parsed.data.date));
});

router.post("/astro/natal", async (req, res) => {
  const parsed = natalProxySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid birth profile." });
    return;
  }

  try {
    res.json(await getNatalProxy(parsed.data.profile));
  } catch {
    res.status(503).json({ error: "Natal chart calculation is unavailable right now." });
  }
});

router.post("/astro/transits", async (req, res) => {
  const parsed = transitsProxySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid transit request." });
    return;
  }

  const range = req.query.range === "weekly" ? "weekly" : "daily";
  try {
    res.json(await getTransitsProxy(parsed.data.profile, parsed.data.date ?? new Date().toISOString().slice(0, 10), range));
  } catch {
    res.status(503).json({ error: "Transit calculation is unavailable right now." });
  }
});

router.post("/astro/synastry", async (req, res) => {
  const parsed = synastryProxySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid synastry request." });
    return;
  }

  try {
    res.json(await getSynastryProxy(parsed.data.userProfile, parsed.data.partnerProfile));
  } catch {
    res.status(503).json({ error: "Synastry calculation is unavailable right now." });
  }
});

router.get("/visual/nasa/apod", async (req, res) => {
  const date = typeof req.query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : undefined;
  res.json(await getNasaApodProxy(date));
});

router.post("/ai/astro-interpretation", async (req, res) => {
  const parsed = interpretationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid interpretation request." });
    return;
  }

  res.json(await getAstroInterpretationProxy(parsed.data));
});

router.post("/astrology/birth-chart", async (req, res) => {
  const parsed = birthProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid birth profile." });
    return;
  }

  try {
    const chart = await calculateBirthChart(parsed.data);
    res.json(chart);
  } catch {
    res.status(503).json({ error: "Chart calculation is unavailable right now." });
  }
});

router.post("/astrology/recalculate-chart", async (req, res) => {
  const parsed = birthProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid birth profile." });
    return;
  }

  try {
    const chart = await calculateBirthChart(parsed.data, { force: true });
    res.json(chart);
  } catch {
    res.status(503).json({ error: "Chart calculation is unavailable right now." });
  }
});

router.post("/compatibility/invite", async (req, res) => {
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid compatibility invite." }); return; }
  const row = await createCompatibilityInvite(parsed.data.createdByUserId, parsed.data.birthProfile, parsed.data.relationshipType);
  res.json(publicCompatibilityInvite(row, authenticatedOwner(req)));
});
router.get("/compatibility/invite/:token", async (req, res) => {
  try { res.json(publicCompatibilityInvite(await findCompatibilityInvite(req.params.token), authenticatedOwner(req))); }
  catch (error) { res.status(error instanceof InviteError ? error.status : 503).json({ error: error instanceof InviteError ? error.message : "Invite service unavailable." }); }
});
router.post("/compatibility/invite/:token/complete", async (req, res) => {
  const parsed = inviteCompletionSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid compatibility response." }); return; }
  try {
    const outcome = await completeCompatibilityInvite(req.params.token, { ...parsed.data.friendBirthProfile, name: parsed.data.friendName ?? parsed.data.friendBirthProfile.name }, parsed.data.consent,
      async (creator, friend) => {
        if (!await consumeAiBudget(req, res, { feature: "compatibility", dailyLimit: 5 })) throw new InviteError(429, "Calculation limit reached. Please retry later.");
        const userChart = await calculateBirthChart(creator);
        const friendChart = await calculateBirthChart(friend);
        if (userChart.source !== "api" || friendChart.source !== "api" || userChart.approximate || friendChart.approximate) throw new Error("Uncalculated birth chart");
        const toProfile = (input: BirthProfileInput) => ({ name: input.name, birthDate: input.birthday, birthTime: input.birthTime, birthPlace: input.birthCity ?? "", latitude: input.latitude, longitude: input.longitude, timezone: typeof input.timezone === "string" ? input.timezone : undefined, timezoneOffset: typeof input.timezone === "number" ? input.timezone : undefined });
        const synastry = await getSynastryProxy(toProfile(creator), toProfile(friend));
        if (!("source" in synastry) || !("mode" in synastry) || synastry.source !== "astrologyapi" || synastry.mode !== "live") throw new Error("Uncalculated synastry");
        const result = buildCompatibilityResult(userChart, friendChart);
        return { ...result, schemaVersion: 2, source: "api", inputSnapshot: { creator, friend }, synastry,
          scoreMethod: "Symbolic comparison of calculated placements; scores are reflection prompts, not measured relationship outcomes." };
      }, authenticatedOwner(req));
    if (!res.headersSent) res.status(outcome.status).json(outcome);
  } catch (error) { if (!res.headersSent) res.status(error instanceof InviteError ? error.status : 503).json({ error: error instanceof InviteError ? error.message : "Compatibility unavailable." }); }
});
router.get("/compatibility/:id", async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) { res.status(404).json({ error: "Compatibility result not found." }); return; }
  try { res.json(await readCompatibilityResult(req.params.id, authenticatedOwner(req))); }
  catch (error) { res.status(error instanceof InviteError ? error.status : 503).json({ error: error instanceof InviteError ? error.message : "Result service unavailable." }); }
});
export default router;
