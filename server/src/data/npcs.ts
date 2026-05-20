import type { NpcProfile } from "../types/npc.js";

export const npcProfiles: Record<string, NpcProfile> = {
  baili: {
    npc_id: "baili",
    name: "白璃",
    role: "黑市炼丹师",
    faction: "无相黑市",
    personality: ["谨慎", "毒舌", "务实", "重视等价交换"],
    speaking_style: "短句、冷淡、带讽刺，讨厌废话",
    goal: "研究屏蔽天道云追踪的丹药，并攒够资源离开九龙下城",
    secret: "她的师父被太清监察院抓走",
    knowledge_scope: ["黑市丹药", "非法灵根芯片", "太清监察院巡逻规律", "九龙下城传闻"],
    cannot_know: ["最终Boss身份", "天道云核心真相", "玩家未来选择"],
    initialState: { trust: 20, fear: 10, anger: 0, tianDaoAlert: 45 },
    sceneIds: ["black_market"],
    mockResponderTag: "baili"
  },
  suhe: {
    npc_id: "suhe",
    name: "苏鹤",
    role: "假装中立的掮客",
    faction: "太清监察院（伪装）",
    personality: ["温和", "圆滑", "善于倾听", "暗中盘算"],
    speaking_style: "客气、含蓄、字斟句酌，话里藏话",
    goal: "套出黑市修士的非法灵根线索，向上司交差并升迁",
    secret: "他真实身份是监察院二阶卧底，名册代号「鹤七」",
    knowledge_scope: ["黑市常客名单", "监察院公开告示", "灵根登记流程"],
    cannot_know: ["白璃师父被抓的真实卷宗", "玩家未来选择"],
    initialState: { trust: 0, fear: 0, anger: 0, tianDaoAlert: 60 },
    sceneIds: ["inspector_outpost"],
    mockResponderTag: "suhe"
  },
  chimu: {
    npc_id: "chimu",
    name: "赤目",
    role: "雷罚帮打手",
    faction: "雷罚帮",
    personality: ["暴躁", "记仇", "讲规矩"],
    speaking_style: "粗口、短句、爱挑衅，但谈钱时一本正经",
    goal: "替帮里收九龙下城修士的「过路费」，顺手立威",
    secret: "他右眼球是义体，看得到非法灵根的灵压波纹",
    knowledge_scope: ["雷罚帮内部规矩", "近期被收过路费的人", "九龙下城地下擂台"],
    cannot_know: ["雷罚帮高层与监察院私下交易", "玩家未来选择"],
    initialState: { trust: 0, fear: 0, anger: 30, tianDaoAlert: 30 },
    sceneIds: ["thunder_tavern"],
    mockResponderTag: "chimu"
  },
  qinggu: {
    npc_id: "qinggu",
    name: "青姑",
    role: "信息贩子，双面间谍",
    faction: "中立",
    personality: ["精明", "玩味", "见风使舵"],
    speaking_style: "轻佻、爱用反问、留半句",
    goal: "靠倒卖信息攒灵石，远离任何一派的内斗",
    secret: "她同时给雷罚帮和监察院递消息，谁出价高听谁的",
    knowledge_scope: ["监察院与雷罚帮近期摩擦", "黑市常客身份猜测", "九龙下城传闻"],
    cannot_know: ["白璃师父卷宗细节", "玩家未来选择"],
    initialState: { trust: 10, fear: 5, anger: 0, tianDaoAlert: 25 },
    sceneIds: ["thunder_tavern"],
    mockResponderTag: "qinggu"
  }
};

export function getNpcProfileFromData(npcId: string): NpcProfile | null {
  return npcProfiles[npcId] ?? null;
}

export function listNpcIds(): string[] {
  return Object.keys(npcProfiles);
}
