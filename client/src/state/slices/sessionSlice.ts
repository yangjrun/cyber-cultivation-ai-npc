import type { StateCreator } from "zustand";
import { listScenes } from "../../api/sceneApi";
import { createSession, type CreateSessionInput } from "../../api/sessionApi";
import { DEFAULT_NPC_ID, DEFAULT_SCENE_ID, MAX_MEMORIES } from "../constants";
import type { GameActions, GameStore } from "../types";
import { readStoredSessionId, restoreOrCreateSession, writeStoredSessionId } from "../utils";

type SessionActions = Pick<GameActions, "initializeSession">;

export const createSessionSlice: StateCreator<GameStore, [], [], SessionActions> = (set, get) => ({
  initializeSession: async (input?: CreateSessionInput) => {
    if (get().sessionLoading || get().sessionId) {
      return;
    }

    set({ sessionLoading: true, error: "" });

    try {
      const [storedSessionId, scenes] = await Promise.all([
        Promise.resolve(readStoredSessionId()),
        listScenes().catch(() => [])
      ]);
      const session = storedSessionId
        ? await restoreOrCreateSession(storedSessionId)
        : await createSession(input);
      writeStoredSessionId(session.sessionId);

      const activeSceneId = session.activeSceneId || DEFAULT_SCENE_ID;
      const sceneNpcIds = scenes.find((s) => s.sceneId === activeSceneId)?.npcIds ?? [];
      const activeNpcId = sceneNpcIds[0] ?? DEFAULT_NPC_ID;
      const memoriesForActive = session.memories.slice(-MAX_MEMORIES);

      set({
        sessionId: session.sessionId,
        playerId: session.playerId,
        player: session.player,
        inventory: session.inventory,
        scenes,
        activeSceneId,
        activeNpcId,
        npcStates: session.npcStates,
        quests: session.quests,
        memoriesByNpc:
          memoriesForActive.length > 0 ? { [activeNpcId]: memoriesForActive } : {},
        sessionLoading: false
      });
      get().appendLog("玩家存档已载入。");
    } catch {
      set({
        sessionLoading: false,
        error: "存档链路中断：无法创建玩家会话。"
      });
      get().appendLog("存档链路异常：会话创建失败。");
    }
  }
});
