import { Router } from "express";
import { getItemDefinition } from "../data/items.js";
import { getGatheringPoint, getGatheringPointsByScene } from "../data/gatheringPoints.js";
import { getDb } from "../db/connection.js";
import { validateGatherBody } from "../schemas/gathering.js";
import { addItem, getInventory } from "../services/inventoryStore.js";
import { applyStateDelta } from "../services/gameState.js";
import { getNpcsInScene } from "../services/sceneStore.js";
import { getPlayer, sessionExists, updatePlayer } from "../services/playerStore.js";
import { calculateGathering } from "../services/gatheringEngine.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import {
  getGatheringCooldowns,
  isGatheringAvailable,
  setGatheringCooldown
} from "../services/gatheringStore.js";

export const gatheringRouter = Router();

/**
 * GET /api/gathering/:sessionId/:sceneId
 * List gathering points in a scene with availability status
 */
gatheringRouter.get("/:sessionId/:sceneId", (req, res, next) => {
  try {
    const { sessionId, sceneId } = req.params;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const points = getGatheringPointsByScene(sceneId);
    const cooldowns = getGatheringCooldowns(sessionId);
    const cooldownMap = new Map(cooldowns.map((c) => [c.pointId, c.nextAvailableAt]));

    const pointsWithStatus = points.map((point) => ({
      pointId: point.pointId,
      name: point.name,
      description: point.description,
      qiCost: point.qiCost,
      cooldownHours: point.cooldownHours,
      alertRisk: point.alertRisk,
      available: isGatheringAvailable(sessionId, point.pointId),
      nextAvailableAt: cooldownMap.get(point.pointId) ?? null
    }));

    res.json({ points: pointsWithStatus });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/gathering/gather
 * Attempt to gather from a point
 */
gatheringRouter.post("/gather", (req, res, next) => {
  try {
    const validation = validateGatherBody(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId, pointId } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);
    const point = getGatheringPoint(pointId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    if (!point) {
      res.status(404).json({ error: "采集点不存在。" });
      return;
    }

    // Check cooldown
    if (!isGatheringAvailable(sessionId, pointId)) {
      res.status(409).json({ error: "采集点冷却中，请稍后再来。" });
      return;
    }

    // Check qi before attempting
    if (player.qiCurrent < point.qiCost) {
      res.status(400).json({ error: "灵气不足，无法采集。" });
      return;
    }

    const result = calculateGathering(player, point);

    const updatedPlayer = getDb().transaction(() => {
      // Consume qi
      const next = updatePlayer(sessionId, { qiCurrent: player.qiCurrent - result.qiCost });

      // Add gathered items
      for (const item of result.itemsGained) {
        addItem(sessionId, item.itemId, item.quantity);
      }

      // Apply tianDaoAlert to NPCs in the scene
      if (result.alertDelta > 0) {
        const npcIds = getNpcsInScene(point.sceneId);
        for (const npcId of npcIds) {
          applyStateDelta(scopedNpcId(sessionId, npcId), {
            trust: 0,
            fear: 0,
            anger: 0,
            tianDaoAlert: result.alertDelta
          });
        }
      }

      // Set cooldown
      if (result.nextAvailableAt) {
        setGatheringCooldown(sessionId, pointId, result.nextAvailableAt);
      }

      return next;
    })();

    // Enrich items with definitions
    const itemsWithDetails = result.itemsGained.map((item) => ({
      itemId: item.itemId,
      quantity: item.quantity,
      item: getItemDefinition(item.itemId)
    }));

    res.json({
      success: result.success,
      itemsGained: itemsWithDetails,
      qiCost: result.qiCost,
      alertDelta: result.alertDelta,
      message: result.message,
      nextAvailableAt: result.nextAvailableAt,
      player: updatedPlayer,
      inventory: getInventory(sessionId)
    });
  } catch (error) {
    next(error);
  }
});
