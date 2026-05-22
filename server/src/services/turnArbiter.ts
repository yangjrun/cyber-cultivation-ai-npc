import { z } from "zod";
import { requestLlm } from "./llmClient.js";
import { mockArbiter } from "./mockResponders/arbiter.js";
import { extractFirstJsonObject } from "./responseValidator.js";
import { getNpcProfile } from "./gameState.js";
import type { ArbiterDecision, SpeakMode } from "../types/chat.js";
import type { LlmMessage } from "../types/llm.js";
import type { NpcState } from "../types/npc.js";
import type { SceneSnapshot } from "../types/scene.js";

const SPEAK_MODES = ["speak", "interrupt", "action_only", "silent"] as const satisfies readonly SpeakMode[];

const decisionSchema = z.object({
  speakers: z.array(
    z.object({
      npcId: z.string(),
      mode: z.enum(SPEAK_MODES)
    })
  ),
  rationale: z.string().optional().default("")
});

export type ArbiterInput = {
  targetNpcId: string;
  playerInput: string;
  scene?: SceneSnapshot;
  npcStates: Record<string, NpcState>;
  lastSpokeTurns: Record<string, number>;
};

export async function arbitrateTurn(input: ArbiterInput): Promise<ArbiterDecision> {
  if (!process.env.LLM_API_KEY) {
    return mockArbiter({
      targetNpcId: input.targetNpcId,
      playerInput: input.playerInput,
      scene: input.scene
    });
  }

  try {
    const raw = await requestLlm({
      messages: buildArbiterPrompt(input),
      playerInput: input.playerInput,
      npcId: "arbiter"
    });

    return parseArbiterResponse(raw, input);
  } catch (error) {
    console.warn("[arbiter] LLM 调用失败，回退到 fallback 决策", error);
    return fallbackDecision(input);
  }
}

function buildArbiterPrompt(input: ArbiterInput): LlmMessage[] {
  const sceneNpcIds = input.scene?.scene.npcIds ?? [input.targetNpcId];
  const npcSummary = sceneNpcIds
    .map((npcId) => {
      const profile = safeGetNpcProfile(npcId);
      const state = input.npcStates[npcId] ?? { trust: 0, fear: 0, anger: 0, tianDaoAlert: 0 };
      const lastSpoke = input.lastSpokeTurns[npcId];
      const lastSpokeText = typeof lastSpoke === "number" ? `${lastSpoke} 回合前说过话` : "尚未发言";
      return `- ${profile.name}（${npcId}）：trust=${state.trust} fear=${state.fear} anger=${state.anger} tianDaoAlert=${state.tianDaoAlert} / ${lastSpokeText}`;
    })
    .join("\n");

  const systemText = [
    "你是赛博修真群聊的「开口仲裁者」。每一轮玩家说话后，你判断这一轮谁开口、谁沉默、谁打断、谁只做动作。",
    "",
    "原则：",
    "1. 默认 1 人开口；2 人需要有冲突或呼应理由；0 人代表玩家这句不值得回应。",
    "2. 被玩家点名的 NPC 优先开口，但允许他憋着不说（比如 anger > 50 时主动沉默）。",
    "3. anger > 50 倾向 interrupt（打断），trust < 0 或上轮已说过且无新刺激倾向 silent。",
    "4. action_only 用于「只做动作不说话」的氛围 NPC。",
    "5. rationale 用 ≤20 字内部理由，便于调试。",
    "",
    "只输出一个 JSON：",
    `{ "speakers": [{ "npcId": "<id>", "mode": "speak|interrupt|action_only|silent" }], "rationale": "..." }`,
    "speakers 数组允许为空（全员沉默）。所有 npcId 必须来自给定的在场列表。"
  ].join("\n");

  const userText = [
    "# 在场 NPC",
    npcSummary,
    "",
    `玩家点名对象：${input.targetNpcId}`,
    `玩家这句：${input.playerInput}`
  ].join("\n");

  return [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: systemText,
          cacheControl: { type: "ephemeral" }
        }
      ]
    },
    {
      role: "user",
      content: userText
    }
  ];
}

function parseArbiterResponse(raw: string, input: ArbiterInput): ArbiterDecision {
  const jsonStr = extractFirstJsonObject(raw);

  if (!jsonStr) {
    return fallbackDecision(input);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return fallbackDecision(input);
  }

  const result = decisionSchema.safeParse(parsed);

  if (!result.success) {
    return fallbackDecision(input);
  }

  const allowedNpcIds = new Set(input.scene?.scene.npcIds ?? [input.targetNpcId]);
  const filtered = result.data.speakers.filter((speaker) => allowedNpcIds.has(speaker.npcId));

  if (result.data.speakers.length > 0 && filtered.length === 0) {
    return fallbackDecision(input);
  }

  return {
    speakers: filtered,
    rationale: result.data.rationale
  };
}

function fallbackDecision(input: ArbiterInput): ArbiterDecision {
  const sceneNpcIds = input.scene?.scene.npcIds ?? [];

  if (!sceneNpcIds.includes(input.targetNpcId)) {
    return {
      speakers: [{ npcId: input.targetNpcId, mode: "speak" }],
      rationale: "fallback：target 不在场，单人。"
    };
  }

  const speakers = [input.targetNpcId, ...sceneNpcIds.filter((id) => id !== input.targetNpcId)]
    .slice(0, 2)
    .map((npcId, index) => ({
      npcId,
      mode: (index === 0 ? "speak" : "interrupt") satisfies SpeakMode
    }));

  return {
    speakers,
    rationale: "fallback：仲裁失败，按默认顺序双人。"
  };
}

function safeGetNpcProfile(npcId: string): { name: string } {
  try {
    return getNpcProfile(npcId);
  } catch {
    return { name: npcId };
  }
}
