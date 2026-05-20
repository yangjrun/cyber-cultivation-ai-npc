export type PersonalityCounterKey =
  | "threats"
  | "completed_quests"
  | "failed_quests"
  | "gifts"
  | "reports"
  | "refused_trades"
  | "successful_trades"
  | "queries";

export type PersonalityCounters = Partial<Record<PersonalityCounterKey, number>>;

export type EvolutionRule = {
  id: string;
  npcId: string;
  requires: PersonalityCounters;
  addsTrait: string;
  once: boolean;
};

export const evolutionRules: EvolutionRule[] = [
  {
    id: "baili_wary_after_threats",
    npcId: "baili",
    requires: { threats: 5 },
    addsTrait: "对玩家保持警觉，开炉前会多扫一眼。",
    once: true
  },
  {
    id: "baili_softer_after_quest",
    npcId: "baili",
    requires: { completed_quests: 1 },
    addsTrait: "记得玩家曾替自己跑过一趟监察院，语气里偶尔露出一丝迟疑。",
    once: true
  },
  {
    id: "suhe_alert_after_queries",
    npcId: "suhe",
    requires: { queries: 8 },
    addsTrait: "已确认玩家是观察对象，回话更圆滑、记录更频。",
    once: true
  },
  {
    id: "chimu_grudge_after_refused",
    npcId: "chimu",
    requires: { refused_trades: 3 },
    addsTrait: "记仇，遇到玩家先掂量一下雷罚锤的份量。",
    once: true
  },
  {
    id: "qinggu_warmer_after_trades",
    npcId: "qinggu",
    requires: { successful_trades: 2 },
    addsTrait: "把玩家归入「能掏灵石的常客」，玩味之外多一分主动。",
    once: true
  },
  {
    id: "qinggu_cautious_after_reports",
    npcId: "qinggu",
    requires: { reports: 2 },
    addsTrait: "察觉玩家可能引来监察院注意，下意识与他保持半步距离。",
    once: true
  }
];

export function getRulesForNpc(npcId: string): EvolutionRule[] {
  return evolutionRules.filter((rule) => rule.npcId === npcId);
}

export function listEvolutionRules(): EvolutionRule[] {
  return evolutionRules;
}
