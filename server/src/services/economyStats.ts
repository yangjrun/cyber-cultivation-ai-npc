import { getDb } from "../db/connection.js";

export type AlchemyQualityBreakdown = {
  failed: number;
  common: number;
  fine: number;
  perfect: number;
};

export type EconomySnapshot = {
  /** 玩家当前灵石 */
  spiritStones: number;
  /** 玩家境界索引 */
  cultivationStageIdx: number;
  /** 背包物品总数（按数量累加） */
  inventoryItemCount: number;
  /** 炼丹尝试统计 */
  alchemy: {
    totalAttempts: number;
    successCount: number;
    successRate: number;
    qualityBreakdown: AlchemyQualityBreakdown;
  };
  /** 任务统计 */
  quests: {
    completed: number;
    failed: number;
    active: number;
  };
};

/**
 * 汇总单个 session 的经济健康度快照，全部基于已有持久化数据查询。
 */
export function getEconomySnapshot(sessionId: string): EconomySnapshot | null {
  const db = getDb();

  const player = db
    .prepare("SELECT spirit_stones, cultivation_stage_idx FROM players WHERE session_id = ?")
    .get(sessionId) as { spirit_stones: number; cultivation_stage_idx: number } | undefined;

  if (!player) {
    return null;
  }

  const inventoryRow = db
    .prepare("SELECT COALESCE(SUM(quantity), 0) AS total FROM player_items WHERE session_id = ?")
    .get(sessionId) as { total: number };

  const alchemyRows = db
    .prepare(
      `SELECT quality, success, COUNT(*) AS count
       FROM alchemy_attempts
       WHERE session_id = ?
       GROUP BY quality, success`
    )
    .all(sessionId) as Array<{ quality: string; success: number; count: number }>;

  const qualityBreakdown: AlchemyQualityBreakdown = { failed: 0, common: 0, fine: 0, perfect: 0 };
  let totalAttempts = 0;
  let successCount = 0;

  for (const row of alchemyRows) {
    totalAttempts += row.count;
    if (row.success === 1) {
      successCount += row.count;
    }
    if (row.quality === "failed" || row.quality === "common" || row.quality === "fine" || row.quality === "perfect") {
      qualityBreakdown[row.quality] += row.count;
    }
  }

  const questRows = db
    .prepare(
      `SELECT status, COUNT(*) AS count
       FROM quest_progress
       WHERE session_id = ?
       GROUP BY status`
    )
    .all(sessionId) as Array<{ status: string; count: number }>;

  let completed = 0;
  let failed = 0;
  let active = 0;

  for (const row of questRows) {
    if (row.status === "completed") {
      completed = row.count;
    } else if (row.status === "failed") {
      failed = row.count;
    } else if (row.status === "accepted" || row.status === "in_progress") {
      active += row.count;
    }
  }

  return {
    spiritStones: player.spirit_stones,
    cultivationStageIdx: player.cultivation_stage_idx,
    inventoryItemCount: inventoryRow.total,
    alchemy: {
      totalAttempts,
      successCount,
      successRate: totalAttempts > 0 ? Number((successCount / totalAttempts).toFixed(3)) : 0,
      qualityBreakdown
    },
    quests: { completed, failed, active }
  };
}
