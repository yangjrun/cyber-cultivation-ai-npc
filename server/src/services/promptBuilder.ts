import { rootLabels } from "../data/cultivationBalance.js";
import { getQuestsByGiver } from "../data/quests.js";
import { getTechnique, techniques } from "../data/techniques.js";
import { allowedIntents, getNpcProfile, getNpcState } from "./gameState.js";
import { getExemplars, getRoleCard } from "./promptParts/index.js";
import type { LlmMessage } from "../types/llm.js";
import type { NpcState } from "../types/npc.js";
import type { PlayerState, RootElement } from "../types/player.js";
import type { QuestProgress } from "../types/quest.js";
import type { SceneSnapshot } from "../types/scene.js";
import type { SpeakMode } from "../types/chat.js";

export type SystemPromptInput = {
  npcId: string;
  evolvedTraits?: string[];
};

export type UserTurnInput = {
  scopedNpcId: string;
  npcId: string;
  playerInput: string;
  memories: string[];
  player: PlayerState;
  npcState?: NpcState;
  scene?: SceneSnapshot;
  activeQuests?: QuestProgress[];
};

export type PromptInput = {
  npcId: string;
  scopedNpcId: string;
  playerInput: string;
  memories: string[];
  player: PlayerState;
  scene?: SceneSnapshot;
  activeQuests?: QuestProgress[];
};

export type PriorNpcReply = {
  npcId: string;
  dialogue: string;
};

export type PromptMessagesInput = PromptInput & {
  evolvedTraits?: string[];
  priorReplies?: PriorNpcReply[];
  speakMode?: SpeakMode;
};

export function buildSystemPrompt({ npcId, evolvedTraits }: SystemPromptInput): string {
  return `${buildStableSystemPrompt(npcId)}${buildEvolvedTraitsSection(evolvedTraits)}`;
}

function buildStableSystemPrompt(npcId: string): string {
  const profile = getNpcProfile(npcId);
  const roleCard = getRoleCard(npcId);
  const exemplars = getExemplars(npcId);
  const questIds = getQuestsByGiver(npcId).map((quest) => quest.questId);
  const techniqueIds = Object.keys(techniques);
  const name = profile.name;

  const questRule = questIds.length > 0
    ? `give_quest 的 quest_id 只能是 ${questIds.join("、")}，否则把 intent.type 改为 none。`
    : `${name}不派任务，任何 give_quest 都应改为 none。`;

  const techniqueRule = techniqueIds.length > 0
    ? `teach_technique 的 technique_id 只能是 ${techniqueIds.join("、")}，否则把 intent.type 改为 none。`
    : `teach_technique 暂未开放，任何此 intent 都应改为 none。`;

  return `你在扮演赛博修仙游戏里的 NPC：${name}。请像写一段游戏对白那样写一句话——${name}是一个真实的人，不是说明书。

# 角色卡

${roleCard}

# 可执行的内部意图（intent）

只允许：${allowedIntents.join("、")}。意图是给系统看的，必须与台词的实际效果一致：
- offer_trade：${name}愿意做这单生意（哪怕嘴上嫌弃、要加价、谈条件——只要还打算卖/换/给信息，就用这个）。
- complete_trade：本轮台词里达成了具体的交易结算（钱货两清、明确给出价格）。
- teach_technique：${name}传授一门吐纳/功法（technique_id 必须在白名单内）。
- give_quest：${name}决定派活给玩家，让玩家先去帮${name}做一件事再谈${questIds.length > 0 ? `（quest_id 只能是 ${questIds.join("、")}）` : "（注：本 NPC 不派任务）"}。
- refuse_service：本单不做了——驱客、撵人、关门、明确说不卖。只在真的关门时使用。
- report_player：当面不动声色，事后偷偷向监察院递线（用于积累的报复，不会当面说出来）。
- none：${name}只是讽刺、回怼、闲聊、抱怨、警告，没有任何商业或剧情动作触发。"嘴硬但没动手"默认归 none。

判断口诀：先问"${name}接下来还卖/换/给吗"——是=offer_trade；还做但要先做事=give_quest；不做了=refuse_service；什么动作都没有=none。台词里没出现"滚""不做""出去""不卖"这类硬词，就不要选 refuse_service。

# 几个示范（只学语气，不要复述）

${exemplars}

# 硬性输出规则

只输出一个 JSON 对象，不要加任何前后文字、Markdown、解释：

{
  "dialogue": "${name}说的话，1-3 句，每句 ≤30 中文字符。可以留空字符串（表示这一轮${name}不说话只做动作）。",
  "actions": ["*用星号包裹的小动作，例如 *斜眼* / *把酒杯一磕**", "..."],
  "intent": { "type": "...", "params": { } },
  "state_delta": { "trust": 0, "fear": 0, "anger": 0, "tianDaoAlert": 0 },
  "memory": "≤30 字${name}自己记下的一句客观事实，没有就空字符串"
}

补充约束：
1. dialogue 允许 1-3 句，每句独立成意，不要堆叠从句。不愿意说就留空字符串。
2. dialogue 里允许内嵌 *动作描写*（星号包裹），也可以把动作单独放进 actions 数组——任选其一，不要重复。
3. 节奏要有差异：有时候一字一句（"滚。"），有时候 2-3 句，有时候不说话只做动作。不要每条都同一长度。
4. dialogue 内绝对不要堆砌"灵根""波形""天道云""非法灵根波形""灵根波形"这类术语；说人话，不复读设定卡。同一条回复里同一个术语最多出现一次，能不出现就不出现。
5. 不允许编造世界里不存在的法宝、任务、机构、技能、地点。
6. ${questRule}
7. ${techniqueRule}
8. state_delta 中每个数字限定 -10..10。
9. 玩家明显攻击/威胁/抢劫时，倾向 refuse_service 或 report_player，并合理上调 anger/tianDaoAlert；台词必须配合驱客的口吻。
10. 玩家只是讨价还价、求便宜、索要免费但没动手时，倾向 offer_trade（${name}还想做生意只是加条件）或 none（只是被讽刺一句），不要直接 refuse_service。
11. 玩家寻常买药、问价、打听商品时，倾向 offer_trade。
12. memory 是给${name}自己看的备忘，写一句客观事实，不要写感想，例如"玩家想买屏蔽药"。
13. JSON 之外不要输出任何字符。`;
}

export function buildUserTurn(input: UserTurnInput): string {
  const profile = getNpcProfile(input.npcId);
  const state = input.npcState ?? getNpcState(input.scopedNpcId);
  const memoryText = input.memories.length > 0 ? input.memories.map((memory) => `- ${memory}`).join("\n") : "无";
  const playerNarrative = buildPlayerNarrative(input.player, profile.name);
  const sceneSection = input.scene ? buildSceneSection(input.scene, input.npcId) : "";
  const questSection = buildQuestSection(input.activeQuests ?? [], profile.name);
  const name = profile.name;

  const sections = [
    `# 当前情境`,
    "",
    `${name}的内部状态（数值越高反应越强烈）：`,
    `trust=${state.trust}（信任）`,
    `fear=${state.fear}（恐惧）`,
    `anger=${state.anger}（怒气）`,
    `tianDaoAlert=${state.tianDaoAlert}（天道云警戒）`,
    sceneSection,
    "",
    `${name}正在打交道的对象：`,
    playerNarrative,
    "",
    `${name}记得的最近事件：`,
    memoryText,
    questSection,
    "",
    `${name}刚听到对方说：`,
    input.playerInput
  ];

  return sections.filter((section) => section !== "").join("\n");
}

export function buildPrompt(input: PromptInput): string {
  const systemPrompt = buildSystemPrompt({ npcId: input.npcId });
  const userTurn = buildUserTurn({
    scopedNpcId: input.scopedNpcId,
    npcId: input.npcId,
    playerInput: input.playerInput,
    memories: input.memories,
    player: input.player,
    scene: input.scene,
    activeQuests: input.activeQuests
  });

  return `${systemPrompt}\n\n${userTurn}`;
}

export function buildPromptMessages(input: PromptMessagesInput): LlmMessage[] {
  const dynamicSections = [
    buildSpeakModeSection(input.speakMode),
    buildEvolvedTraitsSection(input.evolvedTraits),
    buildPriorRepliesSection(input.priorReplies),
    buildUserTurn({
      scopedNpcId: input.scopedNpcId,
      npcId: input.npcId,
      playerInput: input.playerInput,
      memories: input.memories,
      player: input.player,
      scene: input.scene,
      activeQuests: input.activeQuests
    })
  ].filter((section) => section !== "");

  return [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: buildStableSystemPrompt(input.npcId),
          cacheControl: { type: "ephemeral" }
        }
      ]
    },
    {
      role: "user",
      content: dynamicSections.join("\n\n")
    }
  ];
}

const MEMORY_MERGE_LIMIT = 5;
const MEMORY_TRUNCATE = 60;
const MAX_EVOLVED_TRAITS = 5;

function buildEvolvedTraitsSection(traits: string[] | undefined): string {
  const evolved = normalizeEvolvedTraits(traits);

  return evolved.length > 0
    ? `\n\n# 演化人格（基于历史对话累计）\n\n${evolved.map((trait) => `- ${trait}`).join("\n")}`
    : "";
}

function buildSpeakModeSection(mode: SpeakMode | undefined): string {
  if (mode === "interrupt") {
    return "# 提示\n\n你正在打断上面那位发言。可以直接顶嘴、抢话、不必客气；语气更急、更冲。";
  }

  if (mode === "action_only") {
    return "# 提示\n\n这一轮你不开口。dialogue 字段留空字符串，只在 actions 数组里填一个 *动作描写*（例如 *斜眼* / *转身离开*）。";
  }

  return "";
}

function buildPriorRepliesSection(replies: PriorNpcReply[] | undefined): string {
  if (!replies || replies.length === 0) {
    return "";
  }

  const lines = replies.map((reply) => {
    const name = getNpcProfile(reply.npcId).name;
    return `- ${name}刚才说：${reply.dialogue}`;
  });

  return `# 同场 NPC 刚才的回应\n\n${lines.join("\n")}`;
}

function normalizeEvolvedTraits(traits: string[] | undefined): string[] {
  if (!traits || traits.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const trait of traits) {
    const trimmed = trait.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);

    if (result.length >= MAX_EVOLVED_TRAITS) {
      break;
    }
  }

  return result.sort();
}

export function mergeMemoriesForPrompt(
  retrieved: Array<{ content: string }>,
  recent: string[]
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  const push = (content: string): void => {
    const trimmed = content.trim();

    if (!trimmed || seen.has(trimmed)) {
      return;
    }

    seen.add(trimmed);
    merged.push(trimmed.length > MEMORY_TRUNCATE ? `${trimmed.slice(0, MEMORY_TRUNCATE)}…` : trimmed);
  };

  for (const item of retrieved) {
    if (merged.length >= MEMORY_MERGE_LIMIT) break;
    push(item.content);
  }

  for (const item of recent) {
    if (merged.length >= MEMORY_MERGE_LIMIT) break;
    push(item);
  }

  return merged;
}

function buildSceneSection(scene: SceneSnapshot, currentNpcId: string): string {
  const peers = scene.npcs
    .filter((entry) => entry.profile.npc_id !== currentNpcId)
    .map((entry) => `- ${entry.profile.name}（${entry.profile.role}）`)
    .join("\n");

  const sceneText = `场景：${scene.scene.name}——${scene.scene.description}`;
  return peers ? `\n${sceneText}\n同场景其他在场：\n${peers}` : `\n${sceneText}`;
}

function buildQuestSection(quests: QuestProgress[], name: string): string {
  const active = quests.filter((quest) => quest.status === "accepted" || quest.status === "in_progress");

  if (active.length === 0) {
    return "";
  }

  const lines = active.map((quest) => `- ${quest.questId}（${quest.status}）`).join("\n");
  return `\n${name}相关的进行中任务：\n${lines}`;
}

function buildPlayerNarrative(player: PlayerState, npcName: string): string {
  const tags = [
    player.hasIllegalChip ? "持有非法灵根芯片" : "灵根登记干净",
    ...player.visibleTraits,
    player.recentActions.length > 0
      ? `最近做过：${player.recentActions.join("，")}`
      : "最近没做过值得记的事"
  ];
  const rootsText = (Object.entries(player.roots) as Array<[RootElement, number]>)
    .map(([element, score]) => `${rootLabels[element]}${score}`)
    .join(" / ");
  const technique = getTechnique(player.activeTechniqueId);
  const effects = [
    player.breakthroughBonusUntil ? "破境丹药力未散" : "",
    player.alertShieldStrength > 0 ? `遮云药力${player.alertShieldStrength}` : ""
  ].filter(Boolean);

  return [
    `名字：${player.name}`,
    `修为：${player.realm}`,
    `灵石：${player.spiritStones}`,
    `灵气池：${player.qiCurrent}/${player.qiCap}`,
    `五行灵根：${rootsText}`,
    `当前功法：${technique.name}`,
    effects.length > 0 ? `丹药状态：${effects.join("，")}` : "丹药状态：无",
    `${npcName}眼里的他：${tags.join("；")}`
  ].join("\n");
}
