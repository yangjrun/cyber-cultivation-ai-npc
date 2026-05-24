import { Router } from "express";
import { z } from "zod";
import { getNpcProfile } from "../services/gameState.js";
import { getRecentMemories, retrieveRelevantMemories } from "../services/memoryStore.js";
import { getMetricsSnapshot } from "../services/observability.js";
import { sessionExists } from "../services/playerStore.js";
import { scopedNpcId as makeScopedNpcId } from "../services/scopedNpcId.js";

export const debugRouter = Router();

debugRouter.get("/metrics", (_req, res) => {
  res.json(getMetricsSnapshot());
});

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
  npcId: z.string().min(1)
});

const querySchema = z.object({
  q: z.string().min(1).max(200),
  k: z.coerce.number().int().min(1).max(20).optional()
});

debugRouter.get("/memory/:sessionId/:npcId", async (req, res, next) => {
  try {
    const params = paramsSchema.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.issues[0]?.message ?? "params 格式错误。" });
      return;
    }

    const query = querySchema.safeParse(req.query);

    if (!query.success) {
      res.status(400).json({ error: query.error.issues[0]?.message ?? "query 格式错误。" });
      return;
    }

    const { sessionId, npcId } = params.data;

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

    const scopedNpcId = makeScopedNpcId(sessionId, npcId);
    const k = query.data.k ?? 5;

    const [retrieved, recent] = await Promise.all([
      retrieveRelevantMemories(scopedNpcId, query.data.q, k),
      Promise.resolve(getRecentMemories(scopedNpcId, 3))
    ]);

    res.json({
      sessionId,
      npcId,
      query: query.data.q,
      k,
      retrieved,
      recent
    });
  } catch (error) {
    next(error);
  }
});

export function isDebugApiEnabled(): boolean {
  if (process.env.ENABLE_DEBUG_API === "true") {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}
