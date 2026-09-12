import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tarotRouter from "./tarot";
import hintRouter from "./hint";
import speechRouter from "./speech";
import profileRouter from "./profile";
import historyRouter from "./history";
import dailyReceiptsRouter from "./dailyReceipts";
import astrologyRouter from "./astrology";
import deviceSessionsRouter from "./deviceSessions";
import { requireDeviceSession, optionalDeviceSession } from "../lib/deviceSession";
import { findCompatibilityInvite, publicCompatibilityInvite, InviteError } from "../modules/astrology/compatibilityStore";
import { takeBudget, trustedIpKey } from "../lib/durableBudget";

const router: IRouter = Router();

router.use(healthRouter);
router.use(deviceSessionsRouter);
router.get("/compatibility/invite/:token", optionalDeviceSession, async (req, res) => {
  await takeBudget([{ key: `invite-read:${trustedIpKey(req)}`, limit: 60, windowMs: 60000 }]);
  res.set("Cache-Control", "no-store");
  try { res.json(publicCompatibilityInvite(await findCompatibilityInvite(String(req.params.token)), req.deviceSession?.ownerId)); }
  catch (error) { if (error instanceof InviteError) res.status(error.status).json({ error: error.message }); else throw error; }
});
router.use(requireDeviceSession);
router.use(async (req, _res, next) => {
  await takeBudget([
    { key: `private:owner:${req.deviceSession!.ownerId}`, limit: 120, windowMs: 60000 },
    { key: "private:global:day", limit: 20000, windowMs: 86400000 },
  ]);
  next();
});
router.use(tarotRouter);
router.use(hintRouter);
router.use(speechRouter);
router.use(profileRouter);
router.use(historyRouter);
router.use(dailyReceiptsRouter);
router.use(astrologyRouter);

export default router;
