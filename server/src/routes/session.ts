import { Router } from "express";
import { z } from "zod";
import { getNpcState } from "../services/gameState.js";
import { getInventory } from "../services/inventoryStore.js";
import { getRecentMemories } from "../services/memoryStore.js";
import { createSession, getSession } from "../services/playerStore.js";
import type { SessionSnapshot } from "../types/player.js";

const sessionParamsSchema = z.object({
  id: z.string().uuid()
});

export const sessionRouter = Router();

sessionRouter.post("/", (_req, res, next) => {
  try {
    res.status(201).json(createSessionResponse(createSession()));
  } catch (error) {
    next(error);
  }
});

sessionRouter.get("/:id", (req, res, next) => {
  try {
    const parsed = sessionParamsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({ error: "sessionId 格式不正确。" });
      return;
    }

    const session = getSession(parsed.data.id);

    if (!session) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    res.json(createSessionResponse(session));
  } catch (error) {
    next(error);
  }
});

function createSessionResponse(session: SessionSnapshot) {
  const scopedNpcId = `${session.sessionId}::baili`;

  return {
    ...session,
    npcState: getNpcState(scopedNpcId),
    memories: getRecentMemories(scopedNpcId, 5),
    inventory: getInventory(session.sessionId)
  };
}
