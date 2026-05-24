import { Router } from "express";
import { applyStateDelta, getNpcState } from "../services/gameState.js";
import { getPlayer, sessionExists, updatePlayer } from "../services/playerStore.js";
import { calculateBreakthrough, calculateCultivationGain } from "../services/cultivationEngine.js";
import { recordBreakthroughFlags, recordCultivationFlags } from "../services/worldStateFlags.js";
import { validateBreakthroughBody, validateCultivateBody } from "../schemas/cultivation.js";

export const cultivateRouter = Router();
export const breakthroughRouter = Router();

cultivateRouter.post("/", (req, res, next) => {
  try {
    const validation = validateCultivateBody(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId, duration } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    const result = calculateCultivationGain(player, duration);
    const updatedPlayer = updatePlayer(sessionId, { qiCurrent: result.qiCurrent });
    recordCultivationFlags(sessionId);

    res.json({
      player: updatedPlayer,
      qiGained: result.qiGained,
      durationAccepted: result.durationAccepted,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
});

breakthroughRouter.post("/", (req, res, next) => {
  try {
    const validation = validateBreakthroughBody(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    const scopedNpcId = `${sessionId}::baili`;
    const npcState = getNpcState(scopedNpcId);
    const effectiveAlert = Math.max(0, npcState.tianDaoAlert - player.alertShieldStrength);
    const result = calculateBreakthrough(player, effectiveAlert);
    const updatedPlayer = updatePlayer(sessionId, {
      realm: result.realm,
      qiCurrent: result.qiCurrent,
      qiCap: result.qiCap,
      cultivationStageIdx: result.cultivationStageIdx,
      breakthroughBonusUntil: result.success ? null : player.breakthroughBonusUntil,
      alertShieldStrength: player.alertShieldStrength
    });

    if (result.alertDelta !== 0) {
      applyStateDelta(scopedNpcId, { trust: 0, fear: 0, anger: 0, tianDaoAlert: result.alertDelta });
    }

    recordBreakthroughFlags(sessionId, result.success, effectiveAlert);

    res.json({
      success: result.success,
      player: updatedPlayer,
      npcState: getNpcState(scopedNpcId),
      stageLabel: result.stageLabel,
      successRate: result.successRate,
      riskLevel: result.riskLevel,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
});
