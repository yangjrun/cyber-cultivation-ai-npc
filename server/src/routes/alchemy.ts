import { Router } from "express";
import { getAlchemyRecipe } from "../data/alchemyRecipes.js";
import { getItemDefinition } from "../data/items.js";
import { getDb } from "../db/connection.js";
import { addItem, consumeItems, getItemQuantity } from "../services/inventoryStore.js";
import { calculateAlchemyRefine } from "../services/alchemyEngine.js";
import { getPlayer, sessionExists } from "../services/playerStore.js";
import { validateRefineBody } from "../schemas/alchemy.js";

export const alchemyRouter = Router();

alchemyRouter.post("/refine", (req, res, next) => {
  try {
    const validation = validateRefineBody(req.body);

    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }

    const { sessionId, recipeId, fireLevel } = validation.body;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const player = getPlayer(sessionId);
    const recipe = getAlchemyRecipe(recipeId);

    if (!player) {
      res.status(404).json({ error: "玩家不存在。" });
      return;
    }

    if (!recipe) {
      res.status(404).json({ error: "配方不存在。" });
      return;
    }

    for (const material of recipe.requiredMaterials) {
      if (getItemQuantity(sessionId, material.itemId) < material.quantity) {
        res.status(400).json({ error: "材料不足。" });
        return;
      }
    }

    const result = getDb().transaction(() => {
      consumeItems(sessionId, recipe.requiredMaterials);
      const outcome = calculateAlchemyRefine(player, recipe, fireLevel);
      const inventory = addItem(sessionId, outcome.resultItemId, 1);
      getDb().prepare(
        `INSERT INTO alchemy_attempts (session_id, recipe_id, fire_level, quality, success, result_item_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(sessionId, recipeId, fireLevel, outcome.quality, outcome.success ? 1 : 0, outcome.resultItemId, new Date().toISOString());

      return { outcome, inventory };
    })();

    res.json({
      success: result.outcome.success,
      quality: result.outcome.quality,
      resultItem: getItemDefinition(result.outcome.resultItemId),
      inventory: result.inventory,
      message: result.outcome.message
    });
  } catch (error) {
    next(error);
  }
});
