import type { MilestoneId } from "./milestones.js";
import type { NpcState } from "../types/npc.js";
import type { PlayerState } from "../types/player.js";

export type ArtifactId = "fentian_ling" | "mieshen_zhen" | "yinggu_fu";

export type ArtifactUnlockContext = {
  flags: Record<string, number>;
  player: PlayerState;
  npcStates: Record<string, NpcState>;
  unlockedMilestones: Set<MilestoneId>;
};

export type ArtifactDefinition = {
  id: ArtifactId;
  name: string;
  description: string;
  /** Visible tag on PlayerPanel / ArtifactPanel */
  visibleTag: string;
  /** When equipped, this hint gets injected into the prompt for these NPCs (or "*" for all) */
  promptTrigger: {
    npcIds: readonly string[] | "*";
    hint: string;
  };
  unlockedBy: (ctx: ArtifactUnlockContext) => boolean;
};

export const ARTIFACTS: readonly ArtifactDefinition[] = [
  {
    id: "fentian_ling",
    name: "焚天令",
    description: "白璃丹炉旧令。装备后,白璃语气会软三分。",
    visibleTag: "佩焚天令",
    promptTrigger: {
      npcIds: ["baili"],
      hint: "玩家腰间佩着焚天令——你曾用这块令在他经脉接驳点救过他一命,这一世的语气可以软一点,但仍然守住交易底线。"
    },
    unlockedBy: (ctx) => (ctx.npcStates.baili?.trust ?? 0) >= 50
  },
  {
    id: "mieshen_zhen",
    name: "灭神针",
    description: "从监察密钥上拆出的反制构件。装备后,在监察相关 NPC 面前更敢出声。",
    visibleTag: "藏灭神针",
    promptTrigger: {
      npcIds: ["suhe"],
      hint: "玩家暗藏一枚灭神针——他能反制至少一次监察院的望气,你心里清楚这一点,但不要直白说破。"
    },
    unlockedBy: (ctx) => ctx.unlockedMilestones.has("accomplice")
  },
  {
    id: "yinggu_fu",
    name: "影骨符",
    description: "金丹后期才碰得到的尸骨符。装备后灵压对天道镜更隐形。",
    visibleTag: "贴影骨符",
    promptTrigger: {
      npcIds: "*",
      hint: "玩家贴着影骨符——他的灵压波纹被压平,天道镜这一刻读不到他的灵根烙印。"
    },
    unlockedBy: (ctx) => ctx.unlockedMilestones.has("huashen_seed")
  }
];

export function getArtifact(id: ArtifactId): ArtifactDefinition | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export function listArtifacts(): readonly ArtifactDefinition[] {
  return ARTIFACTS;
}

export function isArtifactId(value: unknown): value is ArtifactId {
  return typeof value === "string" && ARTIFACTS.some((a) => a.id === value);
}
