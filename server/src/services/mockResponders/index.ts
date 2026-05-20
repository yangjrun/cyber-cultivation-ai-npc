import type { ValidatedNpcResponse } from "../../types/chat.js";
import { respond as bailiRespond } from "./baili.js";
import { respond as chimuRespond } from "./chimu.js";
import { respond as qingguRespond } from "./qinggu.js";
import { respond as suheRespond } from "./suhe.js";

type MockResponder = (playerInput: string) => ValidatedNpcResponse;

const responders: Record<string, MockResponder> = {
  baili: bailiRespond,
  suhe: suheRespond,
  chimu: chimuRespond,
  qinggu: qingguRespond
};

export function getMockResponder(npcId: string): MockResponder {
  return responders[npcId] ?? bailiRespond;
}

export function hasMockResponder(npcId: string): boolean {
  return Boolean(responders[npcId]);
}
