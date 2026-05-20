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
};

export type SessionSnapshot = {
  sessionId: string;
  playerId: string;
  player: PlayerState;
};
