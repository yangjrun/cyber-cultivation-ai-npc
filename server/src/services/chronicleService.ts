import { randomUUID } from "node:crypto";
import { getDb } from "../db/connection.js";
import { listMilestones, type MilestoneId } from "../data/milestones.js";
import { requestLlmText } from "./llmClient.js";
import { getAllNpcStatesForSession } from "./gameState.js";
import { getRecentMemories } from "./memoryStore.js";
import { getPlayer } from "./playerStore.js";
import { scopedNpcId } from "./scopedNpcId.js";
import {
  evaluateMilestones,
  getUnlockedMilestones,
  getWorldState,
  type UnlockedMilestone
} from "./worldStateEngine.js";
import type { LlmMessage } from "../types/llm.js";
import type { NpcState } from "../types/npc.js";
import type { PlayerState } from "../types/player.js";

const SCENE_NPC_IDS = ["baili", "suhe", "chimu", "qinggu"] as const;

export type RunChronicle = {
  id: number;
  sessionId: string;
  content: string;
  milestonesSnapshot: MilestoneId[];
  createdAt: string;
};

export async function generateChronicle(sessionId: string): Promise<RunChronicle> {
  const player = getPlayer(sessionId);
  if (!player) {
    throw new ChronicleError("Player not found", 404);
  }

  // Re-evaluate to make sure milestones are current before generating.
  evaluateMilestones(sessionId);

  const unlocked = getUnlockedMilestones(sessionId);
  const flags = getWorldState(sessionId);
  const npcStates = getAllNpcStatesForSession(sessionId);
  const memories = collectRecentMemories(sessionId);

  const content = await invokeLlm({ player, unlocked, flags, npcStates, memories });
  const createdAt = new Date().toISOString();
  const snapshot = JSON.stringify(unlocked.map((m) => m.id));

  const result = getDb()
    .prepare(
      "INSERT INTO run_chronicles (session_id, content, milestones_snapshot, created_at) VALUES (?, ?, ?, ?)"
    )
    .run(sessionId, content, snapshot, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    sessionId,
    content,
    milestonesSnapshot: unlocked.map((m) => m.id),
    createdAt
  };
}

export function listChronicles(sessionId: string): RunChronicle[] {
  const rows = getDb()
    .prepare(
      "SELECT id, session_id, content, milestones_snapshot, created_at FROM run_chronicles WHERE session_id = ? ORDER BY id DESC"
    )
    .all(sessionId) as Array<{
      id: number;
      session_id: string;
      content: string;
      milestones_snapshot: string;
      created_at: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    content: row.content,
    milestonesSnapshot: parseSnapshot(row.milestones_snapshot),
    createdAt: row.created_at
  }));
}

export class ChronicleError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ChronicleError";
  }
}

type ChronicleContext = {
  player: PlayerState;
  unlocked: UnlockedMilestone[];
  flags: Record<string, number>;
  npcStates: Record<string, NpcState>;
  memories: string[];
};

async function invokeLlm(ctx: ChronicleContext): Promise<string> {
  const messages = buildChroniclePrompt(ctx);
  return requestLlmText({
    messages,
    callSite: "chronicle",
    mockFallback: () => buildMockChronicle(ctx)
  });
}

function buildChroniclePrompt(ctx: ChronicleContext): LlmMessage[] {
  const milestonesLine = ctx.unlocked.length > 0
    ? ctx.unlocked
        .map((entry) => {
          const def = listMilestones().find((m) => m.id === entry.id);
          return def ? `${def.title}（${def.description}）` : entry.id;
        })
        .join("、")
    : "尚未解锁任何里程碑";

  const traitsLine = ctx.player.visibleTraits.length > 0
    ? ctx.player.visibleTraits.join(" · ")
    : "无可见波形";

  const npcLine = SCENE_NPC_IDS
    .map((npcId) => {
      const state = ctx.npcStates[npcId];
      if (!state) return null;
      return `${npcId}: trust=${state.trust} anger=${state.anger}`;
    })
    .filter((s): s is string => s !== null)
    .join(" | ");

  const memoriesLine = ctx.memories.length > 0 ? ctx.memories.map((m, i) => `${i + 1}. ${m}`).join("\n") : "（无）";

  const flagsLine = Object.entries(ctx.flags)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ") || "（无）";

  const systemText = [
    "你是赛博修真世界的「史官」。",
    "玩家请你为他这一世写一段「回望」——200 至 400 字的散文,第二人称,赛博朋克 + 修真混搭。",
    "要点：",
    "1. 把已解锁的里程碑融进叙事,不要逐项列出标题。",
    "2. 关键事件 / 派系态度要让玩家感觉「这一世真的发生过」。",
    "3. 留余韵——可以是一句反问或一句独白,不要硬给「结局」。",
    "4. 只输出散文正文,不要任何前缀或 markdown。"
  ].join("\n");

  const userText = [
    "# 玩家档案",
    `名字：${ctx.player.name}`,
    `境界：${ctx.player.realm}`,
    `波形：${traitsLine}`,
    "",
    "# 已解锁里程碑",
    milestonesLine,
    "",
    "# 派系态度",
    npcLine || "（暂无数据）",
    "",
    "# 重要事件 flag",
    flagsLine,
    "",
    "# 最近记忆",
    memoriesLine
  ].join("\n");

  return [
    { role: "system", content: systemText },
    { role: "user", content: userText }
  ];
}

function buildMockChronicle(ctx: ChronicleContext): string {
  const id = randomUUID().slice(0, 8);
  const milestoneTitles = ctx.unlocked.map((entry) => {
    const def = listMilestones().find((m) => m.id === entry.id);
    return def?.title ?? entry.id;
  });

  const milestonePart = milestoneTitles.length > 0
    ? `沿途留下了${milestoneTitles.join("、")}的痕迹。`
    : "你还没走出过任何能被记住的拐角。";

  const factionPart = describeFactions(ctx.npcStates);

  return [
    `${ctx.player.name}，这一世你被九龙下城的霓虹塞进角落。`,
    `${ctx.player.realm}，${ctx.player.visibleTraits.join("、") || "波形未明"}，每一次呼吸都被天道云的频谱核对。`,
    milestonePart,
    factionPart,
    "丹炉的火还在烧，监察院的扫描器还在响。",
    `[Mock Chronicle ${id}] 这只是史官在 mock 模式下随手写的几行——配上真 LLM 你会看到更细的笔触。`
  ].join("\n");
}

function describeFactions(npcStates: Record<string, NpcState>): string {
  const fragments: string[] = [];
  const baili = npcStates.baili;
  const suhe = npcStates.suhe;
  const chimu = npcStates.chimu;

  if (baili) {
    if (baili.trust >= 30) fragments.push("白璃的丹炉为你留着位置");
    else if (baili.anger >= 30) fragments.push("白璃对你冷了脸");
  }
  if (suhe) {
    if (suhe.trust <= -10) fragments.push("苏鹤把你的名字写进监察院的便签");
    else if (suhe.trust >= 30) fragments.push("苏鹤把你当成可以喝酒的人");
  }
  if (chimu) {
    if (chimu.trust >= 30) fragments.push("赤目愿意替你挡一刀");
    else if (chimu.anger >= 30) fragments.push("赤目记得你欠他的账");
  }

  return fragments.length > 0 ? fragments.join("，") + "。" : "黑市没有谁特别记得你，也没有谁特别讨厌你。";
}

function collectRecentMemories(sessionId: string): string[] {
  const all: string[] = [];
  for (const npcId of SCENE_NPC_IDS) {
    const sid = scopedNpcId(sessionId, npcId);
    all.push(...getRecentMemories(sid, 5));
  }
  return all.slice(-10);
}

function parseSnapshot(raw: string): MilestoneId[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is MilestoneId => typeof v === "string");
  } catch {
    return [];
  }
}
