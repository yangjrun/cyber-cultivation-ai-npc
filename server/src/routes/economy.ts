import { Router } from "express";
import { z } from "zod";
import { getPlayer, sessionExists, updatePlayer } from "../services/playerStore.js";
import { calculatePassiveIncome } from "../services/passiveIncomeEngine.js";
import { getEconomySnapshot } from "../services/economyStats.js";

export const economyRouter = Router();

const sessionBodySchema = z.object({
  sessionId: z.string().uuid("sessionId 格式不正确。")
});

const sessionParamsSchema = z.object({
  sessionId: z.string().uuid("sessionId 格式不正确。")
});

/**
 * POST /api/economy/passive-income/claim
 * 结算并领取境界被动收入（凝聚灵石）。
 */
economyRouter.post("/passive-income/claim", (req, res, next) => {
  try {
    const parsed = sessionBodySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "请求体格式不正确。" });
      return;
    }

    const { sessionId } = parsed.data;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    const result = calculatePassiveIncome(player.cultivationStageIdx, player.passiveIncomeClaimedAt);

    const updatedPlayer = updatePlayer(sessionId, {
      spiritStones: player.spiritStones + result.amount,
      passiveIncomeClaimedAt: result.newClaimedAt
    });

    res.json({
      claimed: result.claimed,
      amount: result.amount,
      daysAccrued: result.daysAccrued,
      message: result.message,
      player: updatedPlayer
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/economy/:sessionId/stats
 * 返回该 session 的经济健康度快照（只读统计）。
 */
economyRouter.get("/:sessionId/stats", (req, res, next) => {
  try {
    const parsed = sessionParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "sessionId 格式不正确。" });
      return;
    }

    const { sessionId } = parsed.data;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const snapshot = getEconomySnapshot(sessionId);

    if (!snapshot) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    res.json({ stats: snapshot });
  } catch (error) {
    next(error);
  }
});
