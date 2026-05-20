import { Router } from "express";
import { z } from "zod";
import { getAllScenes, getSceneById, getSceneSnapshot, setActiveSceneId } from "../services/sceneStore.js";
import { sessionExists } from "../services/playerStore.js";

export const sceneRouter = Router();

const switchSceneSchema = z.object({
  sessionId: z.string().uuid(),
  sceneId: z.string().min(1)
});

sceneRouter.get("/", (_req, res, next) => {
  try {
    res.json({ scenes: getAllScenes() });
  } catch (error) {
    next(error);
  }
});

sceneRouter.get("/:sceneId/snapshot", (req, res, next) => {
  try {
    const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    const snapshot = getSceneSnapshot(sessionId, req.params.sceneId);

    if (!snapshot) {
      res.status(404).json({ error: "场景不存在。" });
      return;
    }

    res.json(snapshot);
  } catch (error) {
    next(error);
  }
});

sceneRouter.post("/switch", (req, res, next) => {
  try {
    const parsed = switchSceneSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "请求体格式不正确。" });
      return;
    }

    const { sessionId, sceneId } = parsed.data;

    if (!sessionExists(sessionId)) {
      res.status(404).json({ error: "Session 不存在。" });
      return;
    }

    if (!getSceneById(sceneId)) {
      res.status(404).json({ error: "场景不存在。" });
      return;
    }

    setActiveSceneId(sessionId, sceneId);
    res.json({ sessionId, activeSceneId: sceneId });
  } catch (error) {
    next(error);
  }
});
