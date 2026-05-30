import { Router } from "express";
import { getItemDefinition } from "../data/items.js";
import { getSeedStock } from "../data/npcShops.js";
import { getDb } from "../db/connection.js";
import { validateShopParams, validateTradeBody } from "../schemas/trade.js";
import { addItem, consumeItems, getInventory, getItemQuantity } from "../services/inventoryStore.js";
import { applyStateDelta, getNpcProfile, getNpcState } from "../services/gameState.js";
import { getPlayer, sessionExists, updatePlayer } from "../services/playerStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import {
  adjustShopBalance,
  adjustShopStock,
  getShopBalance,
  getShopItemQuantity,
  getShopStock,
  regenerateAllShopBalances
} from "../services/tradeStore.js";
import {
  computeBuyUnitPrice,
  computeSellUnitPrice,
  isTradeRefused,
  type NpcMood,
  type ItemQuality
} from "../services/tradeEngine.js";
import type { PlayerState } from "../types/player.js";

export const tradeRouter = Router();

type ShopSnapshot = {
  npcId: string;
  npcName: string;
  npcSpiritStones: number;
  refused: boolean;
  reason?: string;
  items: Array<{ itemId: string; item: ReturnType<typeof getItemDefinition>; quantity: number; buyUnitPrice: number }>;
  sellQuotes: Array<{ itemId: string; item: ReturnType<typeof getItemDefinition>; quantity: number; sellUnitPrice: number }>;
};

function toMood(state: { trust: number; fear: number; anger: number }): NpcMood {
  return { trust: state.trust, fear: state.fear, anger: state.anger };
}

function buildShopSnapshot(sessionId: string, npcId: string, player: PlayerState): ShopSnapshot {
  const npcState = getNpcState(scopedNpcId(sessionId, npcId));
  const mood = toMood(npcState);
  const refusal = isTradeRefused(mood);

  const items = getShopStock(sessionId, npcId).map((stock) => {
    const definition = getItemDefinition(stock.itemId);
    const buyUnitPrice = computeBuyUnitPrice({
      basePrice: definition?.basePrice ?? 0,
      npcMood: mood,
      npcStock: stock.quantity,
      referenceStock: getSeedStock(npcId, stock.itemId),
      cultivationStageIdx: player.cultivationStageIdx
    });

    return { itemId: stock.itemId, item: definition, quantity: stock.quantity, buyUnitPrice };
  });

  const sellQuotes = getInventory(sessionId).map((entry) => {
    const definition = getItemDefinition(entry.itemId);
    // Filter out "failed" quality for sell quotes (only common/fine/perfect are sellable)
    const sellableQuality: ItemQuality | undefined =
      entry.quality === "failed" ? undefined : entry.quality;
    const sellUnitPrice = computeSellUnitPrice({
      basePrice: definition?.basePrice ?? 0,
      npcMood: mood,
      npcStock: getShopItemQuantity(sessionId, npcId, entry.itemId),
      referenceStock: getSeedStock(npcId, entry.itemId),
      cultivationStageIdx: player.cultivationStageIdx
    }, sellableQuality);

    return { itemId: entry.itemId, item: definition, quantity: entry.quantity, sellUnitPrice, quality: entry.quality };
  });

  return {
    npcId,
    npcName: getNpcProfile(npcId).name,
    npcSpiritStones: getShopBalance(sessionId, npcId),
    refused: refusal.refused,
    reason: refusal.reason,
    items,
    sellQuotes
  };
}

tradeRouter.get("/:sessionId/:npcId", (req, res, next) => {
  try {
    const validation = validateShopParams(req.params);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId, npcId } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    regenerateAllShopBalances(sessionId);

    res.json({ shop: buildShopSnapshot(sessionId, npcId, player) });
  } catch (error) {
    next(error);
  }
});

tradeRouter.post("/buy", (req, res, next) => {
  try {
    const validation = validateTradeBody(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId, npcId, itemId, quantity } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);
    const definition = getItemDefinition(itemId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    if (!definition) {
      res.status(404).json({ error: "物品不存在。" });
      return;
    }

    const npcState = getNpcState(scopedNpcId(sessionId, npcId));
    const refusal = isTradeRefused(toMood(npcState));

    if (refusal.refused) {
      res.status(409).json({ error: refusal.reason ?? "对方拒绝交易。" });
      return;
    }

    const shopQuantity = getShopItemQuantity(sessionId, npcId, itemId);

    if (shopQuantity < quantity) {
      res.status(400).json({ error: "对方存货不足。" });
      return;
    }

    const unitPrice = computeBuyUnitPrice({
      basePrice: definition.basePrice,
      npcMood: toMood(npcState),
      npcStock: shopQuantity,
      referenceStock: getSeedStock(npcId, itemId),
      cultivationStageIdx: player.cultivationStageIdx
    });
    const totalPrice = unitPrice * quantity;

    if (player.spiritStones < totalPrice) {
      res.status(400).json({ error: "灵石不足。" });
      return;
    }

    const updatedPlayer = getDb().transaction(() => {
      adjustShopStock(sessionId, npcId, itemId, -quantity);
      adjustShopBalance(sessionId, npcId, totalPrice);
      addItem(sessionId, itemId, quantity);
      const next = updatePlayer(sessionId, { spiritStones: player.spiritStones - totalPrice });
      applyStateDelta(scopedNpcId(sessionId, npcId), { trust: 1, fear: 0, anger: 0, tianDaoAlert: 0 });
      return next;
    })();

    res.json({
      kind: "buy",
      itemId,
      item: definition,
      quantity,
      unitPrice,
      totalPrice,
      player: updatedPlayer,
      inventory: getInventory(sessionId),
      npcState: getNpcState(scopedNpcId(sessionId, npcId)),
      shop: buildShopSnapshot(sessionId, npcId, updatedPlayer),
      message: `以 ${totalPrice} 灵石购入 ${definition.name} ×${quantity}。`
    });
  } catch (error) {
    next(error);
  }
});

tradeRouter.post("/sell", (req, res, next) => {
  try {
    const validation = validateTradeBody(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId, npcId, itemId, quantity, quality } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    regenerateAllShopBalances(sessionId);

    const player = getPlayer(sessionId);
    const definition = getItemDefinition(itemId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    if (!definition) {
      res.status(404).json({ error: "物品不存在。" });
      return;
    }

    const npcState = getNpcState(scopedNpcId(sessionId, npcId));
    const refusal = isTradeRefused(toMood(npcState));

    if (refusal.refused) {
      res.status(409).json({ error: refusal.reason ?? "对方拒绝交易。" });
      return;
    }

    if (getItemQuantity(sessionId, itemId, quality) < quantity) {
      res.status(400).json({ error: "你的物品不足。" });
      return;
    }

    const unitPrice = computeSellUnitPrice({
      basePrice: definition.basePrice,
      npcMood: toMood(npcState),
      npcStock: getShopItemQuantity(sessionId, npcId, itemId),
      referenceStock: getSeedStock(npcId, itemId),
      cultivationStageIdx: player.cultivationStageIdx
    }, quality);
    const totalPrice = unitPrice * quantity;

    if (getShopBalance(sessionId, npcId) < totalPrice) {
      res.status(400).json({ error: "对方灵石不足，吃不下这笔货。" });
      return;
    }

    const updatedPlayer = getDb().transaction(() => {
      consumeItems(sessionId, [{ itemId, quantity, quality }]);
      adjustShopStock(sessionId, npcId, itemId, quantity);
      adjustShopBalance(sessionId, npcId, -totalPrice);
      return updatePlayer(sessionId, { spiritStones: player.spiritStones + totalPrice });
    })();

    const qualityLabel = quality ? `(${quality === "perfect" ? "上品" : quality === "fine" ? "良品" : "普通"})` : "";
    res.json({
      kind: "sell",
      itemId,
      item: definition,
      quantity,
      quality,
      unitPrice,
      totalPrice,
      player: updatedPlayer,
      inventory: getInventory(sessionId),
      npcState: getNpcState(scopedNpcId(sessionId, npcId)),
      shop: buildShopSnapshot(sessionId, npcId, updatedPlayer),
      message: `卖出 ${definition.name}${qualityLabel} ×${quantity}，入账 ${totalPrice} 灵石。`
    });
  } catch (error) {
    next(error);
  }
});
