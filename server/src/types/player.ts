export type RootElement = "metal" | "wood" | "water" | "fire" | "earth";

export type ElementRoots = Record<RootElement, number>;

export type PlayerProfile = {
  id: string;
  sessionId: string;
  name: string;
  hasIllegalChip: boolean;
  visibleTraits: string[];
  recentActions: string[];
};

export type PlayerState = PlayerProfile & {
  realm: string;
  spiritStones: number;
  qiCurrent: number;
  qiCap: number;
  cultivationStageIdx: number;
  roots: ElementRoots;
  activeTechniqueId: string;
  breakthroughBonusUntil: string | null;
  alertShieldUntil: string | null;
  alertShieldStrength: number;
};

export type SessionSnapshot = {
  sessionId: string;
  playerId: string;
  player: PlayerState;
};
