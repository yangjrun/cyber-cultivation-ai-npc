import type { SceneDefinition } from "../types/scene.js";

export const DEFAULT_SCENE_ID = "black_market";

export const sceneDefinitions: Record<string, SceneDefinition> = {
  black_market: {
    sceneId: "black_market",
    name: "无相黑市",
    description: "九龙下城最深的废弃地铁站改的黑市。蓝紫色的灯管低垂，丹炉的烟从瓦楞缝里冒出，所有人都低着头走路。",
    backgroundAsset: "/scenes/black_market.png",
    npcIds: ["baili"],
    unlockedByDefault: true
  },
  inspector_outpost: {
    sceneId: "inspector_outpost",
    name: "监察院外围",
    description: "太清监察院在九龙下城设的临时哨所，全息封条贴满墙面。掮客们在哨所外的台阶上低声交易，巡逻队两小时一过。",
    backgroundAsset: "/scenes/inspector_outpost.png",
    npcIds: ["suhe"],
    unlockedByDefault: true
  },
  thunder_tavern: {
    sceneId: "thunder_tavern",
    name: "雷罚酒馆",
    description: "雷罚帮在地下三层开的酒馆，灵酒掺着杂讯电流。常客是过路费收员、信息贩子、还有等着被雷罚帮收编的散修。",
    backgroundAsset: "/scenes/thunder_tavern.png",
    npcIds: ["chimu", "qinggu"],
    unlockedByDefault: true
  },
  player_cave: {
    sceneId: "player_cave",
    name: "玩家洞府",
    description: "你在九龙下城外废弃管道里挖出来的临时洞府。墙上贴着自制屏蔽符，地上有一张破草席——勉强能打坐。",
    backgroundAsset: "/scenes/player_cave.png",
    npcIds: [],
    unlockedByDefault: true
  }
};

export function getSceneDefinition(sceneId: string): SceneDefinition | null {
  return sceneDefinitions[sceneId] ?? null;
}

export function listScenes(): SceneDefinition[] {
  return Object.values(sceneDefinitions);
}
