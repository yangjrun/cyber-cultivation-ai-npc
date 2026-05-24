import type { PlayerState } from "../types/player.js";
import type { QuestProgress } from "../types/quest.js";
import type { NpcState } from "../types/npc.js";

export type MilestoneId =
  | "informant"
  | "accomplice"
  | "lei_survivor"
  | "market_regular"
  | "huashen_seed"
  | "inspector_pawn"
  | "lei_ally"
  | "lone_wolf";

export type MilestoneContext = {
  flags: Record<string, number>;
  player: PlayerState;
  npcStates: Record<string, NpcState>;
  quests: QuestProgress[];
  sessionAgeMs: number;
};

export type MilestoneDefinition = {
  id: MilestoneId;
  title: string;
  description: string;
  unlockedBy: (ctx: MilestoneContext) => boolean;
};

const MIN_LONE_WOLF_SESSION_MS = 5 * 60 * 1000; // 5 minutes minimum before "lone wolf" can apply

export const MILESTONES: readonly MilestoneDefinition[] = [
  {
    id: "informant",
    title: "揭发者",
    description: "你向监察院递过情报,把同伴当筹码。",
    unlockedBy: (ctx) => (ctx.flags.spoke_about_undercover ?? 0) > 0 && (ctx.npcStates.suhe?.trust ?? 0) < -10
  },
  {
    id: "accomplice",
    title: "共犯",
    description: "你和黑市站到了同一条战线,偷过监察密钥。",
    unlockedBy: (ctx) =>
      ctx.quests.some((q) => q.questId === "steal_inspector_key" && q.status === "completed")
  },
  {
    id: "lei_survivor",
    title: "雷罚生还者",
    description: "在天道云锁定的高警戒下硬抗了一次突破。",
    unlockedBy: (ctx) => (ctx.flags.high_alert_breakthrough ?? 0) > 0
  },
  {
    id: "market_regular",
    title: "黑市常客",
    description: "和黑市做了 5 次以上的成单交易,门面的丹炉记得你。",
    unlockedBy: (ctx) => (ctx.flags.completed_trades ?? 0) >= 5
  },
  {
    id: "huashen_seed",
    title: "化神种子",
    description: "你已经突破到金丹中后期——再往上,就是化神。",
    unlockedBy: (ctx) => ctx.player.cultivationStageIdx >= 12
  },
  {
    id: "inspector_pawn",
    title: "监察院耳目",
    description: "你不止揭发了一次,监察院开始相信你能值更多钱。",
    unlockedBy: (ctx) => (ctx.flags.reported_to_inspector ?? 0) >= 2
  },
  {
    id: "lei_ally",
    title: "雷罚帮兄弟",
    description: "赤目把你算进雷罚帮的人头里,他下次出血会替你挡。",
    unlockedBy: (ctx) =>
      (ctx.npcStates.chimu?.trust ?? 0) >= 50 && (ctx.flags.helped_chimu ?? 0) > 0
  },
  {
    id: "lone_wolf",
    title: "独行客",
    description: "在九龙下城活了一段时间,却没和任何人撞过一笔交易。",
    unlockedBy: (ctx) =>
      ctx.sessionAgeMs > MIN_LONE_WOLF_SESSION_MS && (ctx.flags.completed_trades ?? 0) === 0
  }
];

export function getMilestone(id: MilestoneId): MilestoneDefinition | undefined {
  return MILESTONES.find((m) => m.id === id);
}

export function listMilestones(): readonly MilestoneDefinition[] {
  return MILESTONES;
}
