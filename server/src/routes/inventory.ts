import { Router } from "express";
import { getItemDefinition } from "../data/items.js";
import { applyStateDelta, getNpcState } from "../services/gameState.js";
import { consumeItems, getInventory, getItemQuantity } from "../services/inventoryStore.js";
import { getPlayer, sessionExists, updatePlayer } from "../services/playerStore.js";
import { validateUseItemBody } from "../schemas/alchemy.js";

export const inventoryRouter = Router();

inventoryRouter.post("/use", (req, res, next) => {
  try {
    const validation = validateUseItemBody(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId, itemId } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);
    const item = getItemDefinition(itemId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    if (!item || item.type !== "pill" || !item.effect) {
      res.status(400).json({ error: "该物品不能使用。" });
      return;
    }

    if (getItemQuantity(sessionId, itemId) <= 0) {
      res.status(400).json({ error: "物品数量不足。" });
      return;
    }

    consumeItems(sessionId, [{ itemId, quantity: 1 }]);
    const scopedNpcId = `${sessionId}::baili`;
    let updatedPlayer = player;
    let message = `已使用${item.name}。`;

    if (item.effect.type === "restore_qi") {
      updatedPlayer = updatePlayer(sessionId, { qiCurrent: Math.min(player.qiCap, player.qiCurrent + item.effect.amount) });
      message = `${item.name}化开，灵气恢复 ${updatedPlayer.qiCurrent - player.qiCurrent}。`;
    }

    if (item.effect.type === "reduce_alert") {
      applyStateDelta(scopedNpcId, { trust: 0, fear: 0, anger: 0, tianDaoAlert: -item.effect.amount });
      updatedPlayer = updatePlayer(sessionId, { alertShieldStrength: item.effect.amount });
      message = `${item.name}遮住了你的灵压，天道警戒下降。`;
    }

    if (item.effect.type === "breakthrough_bonus") {
      const until = new Date(Date.now() + item.effect.durationSeconds * 1000).toISOString();
      updatedPlayer = updatePlayer(sessionId, { breakthroughBonusUntil: until });
      message = `${item.name}药力入脉，下一次突破更稳。`;
    }

    res.json({
      player: updatedPlayer,
      npcState: getNpcState(scopedNpcId),
      inventory: getInventory(sessionId),
      message
    });
  } catch (error) {
    next(error);
  }
});
