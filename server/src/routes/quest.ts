import { Router } from "express";
import { z } from "zod";
import { getQuestDefinition, listQuestIds } from "../data/quests.js";
import { sessionExists } from "../services/playerStore.js";
import { computeNextAvailableAt } from "../services/questCooldown.js";
import { getAllQuestProgressForSession } from "../services/questStore.js";

export const questRouter = Router();

const sessionParamsSchema = z.object({
  sessionId: z.string().uuid()
});

questRouter.get("/definitions", (_req, res, next) => {
  try {
    const definitions = listQuestIds()
      .map((questId) => getQuestDefinition(questId))
      .filter((def): def is NonNullable<typeof def> => def !== null);

    res.json({ definitions });
  } catch (error) {
    next(error);
  }
});

questRouter.get("/:sessionId", (req, res, next) => {
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

    const progress = getAllQuestProgressForSession(sessionId);
    const enriched = progress.map((entry) => {
      const definition = getQuestDefinition(entry.questId);
      return {
        ...entry,
        definition,
        repeatable: definition?.repeatable ?? false,
        nextAvailableAt: definition ? computeNextAvailableAt(definition, entry) : null
      };
    });

    res.json({ quests: enriched });
  } catch (error) {
    next(error);
  }
});
