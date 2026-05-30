import type { NpcState } from "../api/chatApi";

export const STORAGE_KEY = "lower-city.sessionId";
export const LEGACY_STORAGE_KEY = "cyber-cultivation.sessionId";
export const DEFAULT_NPC_ID = "baili";
export const DEFAULT_SCENE_ID = "black_market";
export const PLAYER_NAME = "陆玄";
export const NARRATOR_NPC_ID = "narrator";
export const MAX_LOGS = 5;
export const MAX_MEMORIES = 5;
export const ERROR_MESSAGE = "链路中断：无法连接 NPC。";
export const MAX_INPUT = 80;

export const NPC_NAMES: Record<string, string> = {
  baili: "白璃",
  suhe: "苏鹤",
  chimu: "赤目",
  qinggu: "青姑"
};

export const initialNpcState: NpcState = {
  trust: 20,
  fear: 10,
  anger: 0,
  tianDaoAlert: 45
};
