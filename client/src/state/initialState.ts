import { defaultPlayer } from "../api/sessionApi";
import type { SystemLog } from "../components/SystemLogPanel";
import { DEFAULT_NPC_ID, DEFAULT_SCENE_ID } from "./constants";
import type { GameState } from "./types";
import { nowTime } from "./utils";

export function createInitialState(): GameState {
  return {
    sessionId: "",
    playerId: "",
    player: defaultPlayer,
    inventory: [],
    sessionLoading: false,
    activeSceneId: DEFAULT_SCENE_ID,
    activeNpcId: DEFAULT_NPC_ID,
    inputMode: "dialogue",
    scenes: [],
    scenesLoading: false,
    npcStates: {},
    quests: [],
    questsLoading: false,
    messagesByNpc: {},
    memoriesByNpc: {},
    input: "",
    loading: false,
    cultivationLoading: false,
    breakthroughLoading: false,
    alchemyLoading: false,
    error: "",
    lastActionResult: "",
    lastIntent: "none",
    lastIntentParams: {},
    lastCultivationResult: "",
    lastBreakthroughResult: "",
    lastAlchemyResult: "",
    cultivationResultTick: 0,
    alchemyResultTick: 0,
    alchemyModalOpen: false,
    systemLogs: [createInitialLog()],
    chronicles: [],
    chronicleLoading: false,
    milestones: [],
    milestonesTotal: 0,
    milestonesLoading: false,
    artifacts: [],
    artifactsLoading: false,
    tradeModalOpen: false,
    tradeNpcId: "",
    shop: null,
    tradeLoading: false,
    lastTradeResult: "",
    tradeResultTick: 0,
    gatheringModalOpen: false,
    gatheringPoints: [],
    gatheringLoading: false,
    lastGatheringResult: "",
    gatheringResultTick: 0,
    passiveIncomeLoading: false,
    lastPassiveIncomeResult: "",
    passiveIncomeResultTick: 0
  };
}

function createInitialLog(): SystemLog {
  return {
    id: "init",
    time: nowTime(),
    text: "已连接对话核心。"
  };
}
