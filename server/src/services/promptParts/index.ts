import * as baili from "./baili.js";
import * as chimu from "./chimu.js";
import * as qinggu from "./qinggu.js";
import * as suhe from "./suhe.js";

type RoleCardModule = {
  getRoleCard: () => string;
  getExemplars: () => string;
};

const modules: Record<string, RoleCardModule> = {
  baili,
  suhe,
  chimu,
  qinggu
};

export function getRoleCard(npcId: string): string {
  const mod = modules[npcId];

  if (!mod) {
    throw new Error(`No role card registered for NPC: ${npcId}`);
  }

  return mod.getRoleCard();
}

export function getExemplars(npcId: string): string {
  const mod = modules[npcId];

  if (!mod) {
    throw new Error(`No exemplars registered for NPC: ${npcId}`);
  }

  return mod.getExemplars();
}

export function hasRoleCard(npcId: string): boolean {
  return Boolean(modules[npcId]);
}
