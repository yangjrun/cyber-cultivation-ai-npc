import { Router } from "express";
import { z } from "zod";
import { listMilestones } from "../data/milestones.js";
import { generateChronicle, listChronicles, ChronicleError } from "../services/chronicleService.js";
import { sessionExists } from "../services/playerStore.js";
import { evaluateMilestones, getUnlockedMilestones } from "../services/worldStateEngine.js";

const paramsSchema = z.object({ sessionId: z.string().uuid() });

export const chronicleRouter = Router();

chronicleRouter.post("/:sessionId", async (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "sessionId 格式不正确。" });
      return;
    }
    if (!sessionExists(parsed.data.sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }
    const chronicle = await generateChronicle(parsed.data.sessionId);
    res.status(201).json(chronicle);
  } catch (error) {
    if (error instanceof ChronicleError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

chronicleRouter.get("/:sessionId", (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "sessionId 格式不正确。" });
      return;
    }
    if (!sessionExists(parsed.data.sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }
    res.json({ chronicles: listChronicles(parsed.data.sessionId) });
  } catch (error) {
    next(error);
  }
});

chronicleRouter.get("/:sessionId/milestones", (req, res, next) => {
  try {
    const parsed = paramsSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "sessionId 格式不正确。" });
      return;
    }
    if (!sessionExists(parsed.data.sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }
    // Re-evaluate so any newly-satisfied milestones are reflected.
    evaluateMilestones(parsed.data.sessionId);
    const unlocked = getUnlockedMilestones(parsed.data.sessionId);
    const all = listMilestones();
    res.json({
      unlocked,
      total: all.length,
      catalog: unlocked.map((entry) => {
        const def = all.find((m) => m.id === entry.id);
        return {
          id: entry.id,
          title: def?.title ?? entry.id,
          description: def?.description ?? "",
          unlockedAt: entry.unlockedAt
        };
      })
    });
  } catch (error) {
    next(error);
  }
});
