import { applyStateDelta } from "./gameState.js";
import { addMemory } from "./memoryStore.js";
import { scanForbiddenKeywords } from "./forbiddenKeywords.js";
import { scopedNpcId } from "./scopedNpcId.js";
import { recordCombatFlags } from "./worldStateFlags.js";
import type { NpcState } from "../types/npc.js";
import type { SceneSnapshot } from "../types/scene.js";

export type ActionResolveInput = {
  sessionId: string;
  playerInput: string;
  scene?: SceneSnapshot;
};

export type ActionWitness = {
  npcId: string;
  tianDaoAlertDelta: number;
  angerDelta: number;
  fearDelta: number;
  memory: string;
  state: NpcState;
};

export type ActionResolveResult = {
  narration: string;
  verb: ActionVerb;
  targetNpcId: string | null;
  hits: string[];
  tianDaoAlertDelta: number;
  witnesses: ActionWitness[];
  affectedStates: Record<string, NpcState>;
};

export type ActionVerb = "潜行" | "撤离" | "出手" | "搜查" | "动作";

const STEALTH_PATTERNS = ["偷", "摸", "蹑", "潜", "溜"];
const FLEE_PATTERNS = ["逃", "跑", "走", "撤"];
const ATTACK_PATTERNS = ["打", "砍", "刺", "袭", "攻", "踹", "揍", "拳", "刀", "剑"];
const SEARCH_PATTERNS = ["翻", "搜", "查", "看一看", "瞄"];

const ATTACK_ANGER = 8;
const ATTACK_FEAR = 2;
const BYSTANDER_ALERT = 1;

export async function resolveAction({
  sessionId,
  playerInput,
  scene
}: ActionResolveInput): Promise<ActionResolveResult> {
  const verb = classifyVerb(playerInput);
  const narration = buildNarration(playerInput, verb);
  const { hits, tianDaoAlertDelta: forbiddenDelta } = scanForbiddenKeywords(playerInput);
  const target = verb === "出手" && scene ? findTargetNpc(playerInput, scene) : null;
  const witnesses: ActionWitness[] = [];
  const affectedStates: Record<string, NpcState> = {};

  recordCombatFlags(sessionId, verb, hits.length);

  if (scene) {
    for (const { profile } of scene.npcs) {
      const isTarget = target !== null && profile.npc_id === target;
      const sNpcId = scopedNpcId(sessionId, profile.npc_id);
      const tianDaoAlertDelta = isTarget ? forbiddenDelta : forbiddenDelta > 0 ? forbiddenDelta : verb === "出手" ? BYSTANDER_ALERT : 0;
      const angerDelta = isTarget ? ATTACK_ANGER : 0;
      const fearDelta = isTarget ? ATTACK_FEAR : 0;

      let nextState: NpcState | null = null;

      if (angerDelta !== 0 || fearDelta !== 0 || tianDaoAlertDelta !== 0) {
        nextState = applyStateDelta(sNpcId, {
          trust: 0,
          fear: fearDelta,
          anger: angerDelta,
          tianDaoAlert: tianDaoAlertDelta
        });
        affectedStates[profile.npc_id] = nextState;
      }

      const memoryContent = isTarget
        ? `玩家对${profile.name}动手了：${playerInput}`
        : buildWitnessMemory(playerInput, verb);
      await addMemory(sNpcId, memoryContent);

      witnesses.push({
        npcId: profile.npc_id,
        tianDaoAlertDelta,
        angerDelta,
        fearDelta,
        memory: memoryContent,
        state: nextState ?? scene.npcs.find((entry) => entry.profile.npc_id === profile.npc_id)?.state ?? {
          trust: 0,
          fear: 0,
          anger: 0,
          tianDaoAlert: 0
        }
      });
    }
  }

  return {
    narration,
    verb,
    targetNpcId: target,
    hits,
    tianDaoAlertDelta: forbiddenDelta,
    witnesses,
    affectedStates
  };
}

function buildNarration(input: string, verb: ActionVerb): string {
  return `（${verb}：${input}）`;
}

function buildWitnessMemory(input: string, verb: ActionVerb): string {
  return `玩家${verb}：${input}`;
}

function findTargetNpc(input: string, scene: SceneSnapshot): string | null {
  for (const { profile } of scene.npcs) {
    if (input.includes(profile.name)) {
      return profile.npc_id;
    }
  }
  return null;
}

function classifyVerb(input: string): ActionVerb {
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
