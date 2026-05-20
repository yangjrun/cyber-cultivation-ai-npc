export type NpcState = {
  trust: number;
  fear: number;
  anger: number;
  tianDaoAlert: number;
};

export type NpcStateDelta = NpcState;

export type IntentType = "none" | "offer_trade" | "complete_trade" | "teach_technique" | "give_quest" | "report_player" | "refuse_service";

export type NpcIntent = {
  type: IntentType;
  params: Record<string, unknown>;
};

export type NpcProfile = {
  npc_id: string;
  name: string;
  role: string;
  faction: string;
  personality: string[];
  speaking_style: string;
  goal: string;
  secret: string;
  knowledge_scope: string[];
  cannot_know: string[];
  initialState: NpcState;
  sceneIds: string[];
  mockResponderTag?: string;
};

