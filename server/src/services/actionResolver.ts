import { applyStateDelta } from "./gameState.js";
import { addMemory } from "./memoryStore.js";
import { scanForbiddenKeywords } from "./forbiddenKeywords.js";
import { scopedNpcId } from "./scopedNpcId.js";
import type { SceneSnapshot } from "../types/scene.js";

export type ActionResolveInput = {
  sessionId: string;
  playerInput: string;
  scene?: SceneSnapshot;
};

export type ActionWitness = {
  npcId: string;
  tianDaoAlertDelta: number;
  memory: string;
};

export type ActionResolveResult = {
  narration: string;
  hits: string[];
  tianDaoAlertDelta: number;
  witnesses: ActionWitness[];
};

const STEALTH_PATTERNS = ["偷", "摸", "蹑", "潜", "溜"];
const FLEE_PATTERNS = ["逃", "跑", "走", "撤"];
const ATTACK_PATTERNS = ["打", "砍", "刺", "袭", "攻"];
const SEARCH_PATTERNS = ["翻", "搜", "查", "看一看", "瞄"];

export async function resolveAction({
  sessionId,
  playerInput,
  scene
}: ActionResolveInput): Promise<ActionResolveResult> {
  const narration = buildNarration(playerInput);
  const { hits, tianDaoAlertDelta } = scanForbiddenKeywords(playerInput);
  const witnesses: ActionWitness[] = [];
  const memoryContent = buildWitnessMemory(playerInput);

  if (scene) {
    for (const { profile } of scene.npcs) {
      const sNpcId = scopedNpcId(sessionId, profile.npc_id);
      const delta = tianDaoAlertDelta;

      if (delta > 0) {
        applyStateDelta(sNpcId, {
          trust: 0,
          fear: 0,
          anger: 0,
          tianDaoAlert: delta
        });
      }

      await addMemory(sNpcId, memoryContent);
      witnesses.push({
        npcId: profile.npc_id,
        tianDaoAlertDelta: delta,
        memory: memoryContent
      });
    }
  }

  return { narration, hits, tianDaoAlertDelta, witnesses };
}

function buildNarration(input: string): string {
  const verbTag = classifyVerb(input);
  return `（${verbTag}：${input}）`;
}

function buildWitnessMemory(input: string): string {
  return `玩家${classifyVerb(input)}：${input}`;
}

function classifyVerb(input: string): string {
  if (STEALTH_PATTERNS.some((p) => input.includes(p))) {
    return "潜行";
  }
  if (FLEE_PATTERNS.some((p) => input.includes(p))) {
    return "撤离";
  }
  if (ATTACK_PATTERNS.some((p) => input.includes(p))) {
    return "出手";
  }
  if (SEARCH_PATTERNS.some((p) => input.includes(p))) {
    return "搜查";
  }
  return "动作";
}
