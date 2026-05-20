import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db/connection.js";
import { getNpcProfile } from "../services/gameState.js";
import { sessionExists } from "../services/playerStore.js";
import { scopedNpcId as makeScopedNpcId } from "../services/scopedNpcId.js";

export const memoryRouter = Router();

const paramsSchema = z.object({
  sessionId: z.string().uuid(),
  npcId: z.string().min(1)
});

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
});

type MemoryRow = {
  id: number;
  content: string;
  created_at: string;
};

memoryRouter.get("/:sessionId/:npcId", (req, res, next) => {
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

    const limit = query.data.limit ?? 20;
    const scopedNpcId = makeScopedNpcId(sessionId, npcId);

    const rows = getDb()
      .prepare(
        `SELECT id, content, created_at
         FROM memories
         WHERE scoped_npc_id = ?
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(scopedNpcId, limit) as MemoryRow[];

    res.json({
      sessionId,
      npcId,
      memories: rows.map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    next(error);
  }
});
