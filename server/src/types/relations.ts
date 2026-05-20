export type NpcRelation = {
  sessionId: string;
  fromNpc: string;
  toNpc: string;
  trust: number;
  hostility: number;
  updatedAt: string;
};

export type NpcRelationDelta = {
  trust?: number;
  hostility?: number;
};
