import type { NpcRelationDelta } from "../types/relations.js";

type InitialRelationSeed = {
  fromNpc: string;
  toNpc: string;
} & Required<NpcRelationDelta>;

export const initialNpcRelations: InitialRelationSeed[] = [
  { fromNpc: "baili", toNpc: "suhe", trust: -10, hostility: 20 },
  { fromNpc: "baili", toNpc: "chimu", trust: -5, hostility: 30 },
  { fromNpc: "baili", toNpc: "qinggu", trust: 10, hostility: 0 },
  { fromNpc: "suhe", toNpc: "baili", trust: 5, hostility: 0 },
  { fromNpc: "suhe", toNpc: "chimu", trust: 0, hostility: 25 },
  { fromNpc: "suhe", toNpc: "qinggu", trust: 0, hostility: 5 },
  { fromNpc: "chimu", toNpc: "baili", trust: 0, hostility: 15 },
  { fromNpc: "chimu", toNpc: "suhe", trust: -5, hostility: 40 },
  { fromNpc: "chimu", toNpc: "qinggu", trust: 5, hostility: 0 },
  { fromNpc: "qinggu", toNpc: "baili", trust: 15, hostility: 0 },
  { fromNpc: "qinggu", toNpc: "suhe", trust: 0, hostility: 10 },
  { fromNpc: "qinggu", toNpc: "chimu", trust: 10, hostility: 0 }
];
