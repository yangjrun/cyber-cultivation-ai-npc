import { Router } from "express";
import { z } from "zod";
import { listPlayerTraits } from "../data/playerTraits.js";
import { DEFAULT_SCENE_ID } from "../data/scenes.js";
import { getAllNpcStatesForSession, getNpcState, listKnownNpcIds } from "../services/gameState.js";
import { getInventory } from "../services/inventoryStore.js";
import { getRecentMemories } from "../services/memoryStore.js";
import { getAllQuestProgressForSession } from "../services/questStore.js";
import { getActiveSceneId } from "../services/sceneStore.js";
import { createSession, getSession } from "../services/playerStore.js";
import { scopedNpcId } from "../services/scopedNpcId.js";
import { validateCreateSessionBody } from "../schemas/session.js";
import type { SessionSnapshot } from "../types/player.js";

const sessionParamsSchema = z.object({
  id: z.string().uuid()
});

export const sessionRouter = Router();

sessionRouter.post("/", (req, res, next) => {
  try {
    const validation = validateCreateSessionBody(req.body);
    if (!validation.ok) {
      res.status(validation.status).json({ error: validation.message });
      return;
    }
    res.status(201).json(createSessionResponse(createSession(validation.body)));
  } catch (error) {
    next(error);
  }
});

sessionRouter.get("/traits", (_req, res) => {
  res.json({ traits: listPlayerTraits() });
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
  const npcStates = getAllNpcStatesForSession(session.sessionId);
  const activeSceneId = getActiveSceneId(session.sessionId) || DEFAULT_SCENE_ID;
  const defaultNpcId = listKnownNpcIds()[0] ?? "baili";
  const defaultScopedNpcId = scopedNpcId(session.sessionId, defaultNpcId);

  return {
    ...session,
    npcStates,
    activeSceneId,
    quests: getAllQuestProgressForSession(session.sessionId),
    npcState: npcStates[defaultNpcId] ?? getNpcState(defaultScopedNpcId),
    memories: getRecentMemories(defaultScopedNpcId, 5),
    inventory: getInventory(session.sessionId)
  };
}
