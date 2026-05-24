import { Router } from "express";
import { z } from "zod";
import { listArtifacts } from "../data/artifacts.js";
import { getItemDefinition } from "../data/items.js";
import {
  ArtifactError,
  equipArtifact,
  getOwnedArtifacts,
  unequipArtifact
} from "../services/artifactEngine.js";
import { sessionExists } from "../services/playerStore.js";
import { isArtifactId } from "../data/artifacts.js";

const paramsSchema = z.object({ sessionId: z.string().uuid() });
const equipBodySchema = z.object({ artifactId: z.string().min(1) });

export const artifactRouter = Router();

artifactRouter.get("/:sessionId", (req, res, next) => {
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

    const owned = getOwnedArtifacts(parsed.data.sessionId);
    res.json({
      owned: owned.map((entry) => {
        const def = listArtifacts().find((a) => a.id === entry.id);
        const itemDef = getItemDefinition(entry.id);
        return {
          id: entry.id,
          name: def?.name ?? itemDef?.name ?? entry.id,
          description: def?.description ?? itemDef?.description ?? "",
          visibleTag: def?.visibleTag ?? "",
          equipped: entry.equipped
        };
      }),
      catalog: listArtifacts().map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        visibleTag: a.visibleTag
      }))
    });
  } catch (error) {
    next(error);
  }
});

artifactRouter.post("/:sessionId/equip", (req, res, next) => {
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

    const body = equipBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "artifactId 必填。" });
      return;
    }
    if (!isArtifactId(body.data.artifactId)) {
      res.status(400).json({ error: "未知的法宝 id。" });
      return;
    }

    equipArtifact(parsed.data.sessionId, body.data.artifactId);
    res.json({ ok: true });
  } catch (error) {
    if (error instanceof ArtifactError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

artifactRouter.post("/:sessionId/unequip", (req, res, next) => {
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

    const body = equipBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "artifactId 必填。" });
      return;
    }
    if (!isArtifactId(body.data.artifactId)) {
      res.status(400).json({ error: "未知的法宝 id。" });
      return;
    }

    unequipArtifact(parsed.data.sessionId, body.data.artifactId);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
