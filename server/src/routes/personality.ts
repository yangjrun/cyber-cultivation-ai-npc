import { Router } from "express";
import { z } from "zod";
import { getNpcProfile } from "../services/gameState.js";
import { getPersonality, resetPersonality } from "../services/personalityEvolution.js";
import { sessionExists } from "../services/playerStore.js";

export const personalityRouter = Router();

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
  npcId: z.string().min(1)
});

personalityRouter.get("/:sessionId/:npcId", (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "params 格式错误。" });
      return;
    }

    const { sessionId, npcId } = parsed.data;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    try {
      getNpcProfile(npcId);
    } catch {
      res.status(404).json({ error: "NPC 不存在。" });
      return;
    }

    res.json(getPersonality(sessionId, npcId));
  } catch (error) {
    next(error);
  }
});

personalityRouter.delete("/:sessionId/:npcId", (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "params 格式错误。" });
      return;
    }

    const { sessionId, npcId } = parsed.data;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    resetPersonality(sessionId, npcId);
    res.json({ sessionId, npcId, evolvedTraits: [], counters: {}, updatedAt: "" });
  } catch (error) {
    next(error);
  }
});
