import { applyStateDelta } from "./gameState.js";
import { addMemory } from "./memoryStore.js";
import { scanForbiddenKeywords } from "./forbiddenKeywords.js";
import { scopedNpcId } from "./scopedNpcId.js";
import type { NpcState } from "../types/npc.js";
import type { SceneSnapshot } from "../types/scene.js";

export type NarratorEchoInput = {
  sessionId: string;
  playerInput: string;
  scene?: SceneSnapshot;
};

export type NarratorSideEffect = {
  npcId: string;
  tianDaoAlertDelta: number;
  memory: string;
  state: NpcState;
};

export type NarratorEchoResult = {
  narration: string;
  hits: string[];
  tianDaoAlertDelta: number;
  sideEffects: NarratorSideEffect[];
  affectedStates: Record<string, NpcState>;
};

export async function echoMonologue({
  sessionId,
  playerInput,
  scene
}: NarratorEchoInput): Promise<NarratorEchoResult> {
  const { hits, tianDaoAlertDelta } = scanForbiddenKeywords(playerInput);
  const sideEffects: NarratorSideEffect[] = [];
  const affectedStates: Record<string, NpcState> = {};

  if (hits.length > 0 && tianDaoAlertDelta > 0 && scene) {
    const memoryContent = `玩家自言自语提到${hits.join("、")}`;

    for (const { profile } of scene.npcs) {
      const sNpcId = scopedNpcId(sessionId, profile.npc_id);
      const nextState = applyStateDelta(sNpcId, {
        trust: 0,
        fear: 0,
        anger: 0,
        tianDaoAlert: tianDaoAlertDelta
      });
      await addMemory(sNpcId, memoryContent);
      sideEffects.push({
        npcId: profile.npc_id,
        tianDaoAlertDelta,
        memory: memoryContent,
        state: nextState
      });
      affectedStates[profile.npc_id] = nextState;
    }
  }

  return {
    narration: playerInput,
    hits,
    tianDaoAlertDelta,
    sideEffects,
    affectedStates
  };
}
