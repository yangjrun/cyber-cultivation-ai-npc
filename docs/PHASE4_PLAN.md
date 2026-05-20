# 阶段 4 — 向量记忆 + 人格演化 · 实施计划

> 本文件是 `docs/IMPLEMENTATION_PLAN.md` 阶段 4 的执行级展开，独立成档。所有路径相对项目根。
> 阶段 3 (a/b/c) 已合入 commit `f2e2200` → `b51f3f8` → `e7985c3`，本计划在该 baseline 上推进。

## Context

阶段 3 后，4 NPC × 4 场景 + quest 系统已完整。记忆仍是"最近 5 条字符串 + 总量 20 条 LRU 截断"，NPC personality 是静态字段。本阶段把：

1. **memoryStore**：升级为**语义检索**（top-k cosine）+ 最近 buffer 混合
2. **EmbeddingProvider**：抽出接口，先用 hash-based 占位（0 依赖、可测、Windows 友好），后续可无缝替换为 OpenAI text-embedding-3-small
3. **personalityEvolution**：基于累计 `state_delta` + 重大事件触发 `evolved_traits`，注入 prompt
4. **MemoryCrystalPage**：玩家可见的"记忆水晶"页，看到 NPC 记得自己什么 + 演化的性格

### 当前代码现状（对阶段 4 起点的偏移）

| 主计划描述 | 实际代码 | 处理 |
|---|---|---|
| `memories.embedding BLOB` 列已预留 | `schema.sql:42` 已有 | 直接用 |
| `addMemory` 写 LRU 截断 20 | `memoryStore.ts:44-58` 已实现 | 保留 + 加 embedding |
| `getRecentMemories(npcId, k)` | 同上 | 保留，新增 `retrieveRelevantMemories` 并存 |
| `buildUserTurn` 取 5 条最近记忆 | `promptBuilder.ts` 已是动态 | 改为 retrieve + recent 混合 |
| 主计划说 `sqlite-vec` / `hnswlib-node` | 用户选 hash-based 占位 + 可插拔接口 | EmbeddingProvider 抽象，后续替换 0 改动调用方 |
| `personality` 静态数组 | `npcs.ts` 是 `personality: string[]` | 不动 base，叠加 `evolved_traits` 字段（per-session） |
| `MemoryCrystalPage` 未存在 | - | 阶段 4c 新建 |

### 阶段 4 范围（保持主计划口径）

- EmbeddingProvider 接口 + hash 实现 + 单测幂等
- memoryStore.retrieveRelevant(npcId, query, k) 返回 top-k + 相似度，新增即埋 embedding
- promptBuilder 用 retrieve + recent 合并去重
- npc_personality 表（per-session NPC 演化轨迹）+ personalityEvolution.ts
- `/api/debug/memory/:sessionId/:npcId?q=...&k=5` 返回检索结果与分数
- `/api/memory/:sessionId/:npcId` 前端可视
- 前端 MemoryCrystalPage 展示

---

## 总体策略 · 三个 sub-phase

每个 sub-phase 独立可发布，可作为 session 停止点。

```
4a — EmbeddingProvider + memoryStore 向量检索    (1-2 天) ← 后端独立，单测
4b — promptBuilder 混合检索 + debug API          (1-2 天) ← 接进对话主链路
4c — personalityEvolution + 记忆水晶页面          (2-3 天) ← 演化 + 前端可见
```

合计 4-7 天，比主计划 5-7 天略快（因为 hash 占位省了 OpenAI 接入）。

---

## 阶段 4a — EmbeddingProvider + memoryStore 向量检索（1-2 天）

**目标**：抽出向量基础设施，memoryStore 新增 retrieve API。**对话主链路零改动**，旧 `getRecentMemories` 仍工作。

### 可验证交付

- `npm test` 全绿（旧 memoryStore 测试 + 新 embedding/retrieve 测试）
- `EmbeddingProvider.embed("x")` 100 次输出 byte-identical（确定性 hash）
- `retrieveRelevantMemories(npcId, "丹药", 5)` 返回相关性排序的前 5 条
- 历史 memory 行没有 embedding，调用 retrieve 时**自动回填**
- 旧 baili 对话流程零回归

### 新建文件

- `server/src/services/embedding/index.ts` — `EmbeddingProvider` 接口 + `getDefaultProvider()` 工厂（按 env 切换：`EMBEDDING_PROVIDER=hash|openai`，默认 hash）
- `server/src/services/embedding/hashProvider.ts` — 确定性 hash → 128 维 vector + cosine similarity
- `server/src/types/embedding.ts` — `EmbeddingVector = Float32Array | number[]`，`SimilarityScore`
- `server/src/__tests__/embedding.test.ts` — 幂等 + 维度 + 已知 token 距离合理

### 改写文件

- `server/src/services/memoryStore.ts`:
  - `addMemory(npcId, content)` → 写入时同步 embedding（同事务）
  - 新增 `retrieveRelevantMemories(npcId, query, k=5): Array<{content, score, id}>`
  - 新增 `backfillMissingEmbeddings(npcId)` — 内部用，retrieve 前调一次（懒回填）
  - 已有 `getRecentMemories` 保持原签名不动

### EmbeddingProvider 接口设计

```typescript
export interface EmbeddingProvider {
  readonly name: string;       // "hash" / "openai"
  readonly dim: number;        // 128 / 1536
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number;
export function getDefaultProvider(): EmbeddingProvider;  // 单例
```

**hash 实现思路**（避免依赖）：

1. 中文按 char、英文按 word tokenize（≤256 token，超出截断）
2. 每个 token → FNV-1a 32-bit hash → mod 128 桶
3. 桶累加 `1/sqrt(tf)`（TF-IDF 近似），最后 L2 归一化
4. 同字符串永远输出同向量；包含相同关键词的字符串相似度更高

确定性 + 0 依赖 + 单测可 assert 已知输入相似度。后续切 OpenAI 时只需替换 provider，调用方零改动。

### DB 改动

- 无新表，无新列（`embedding BLOB` 已预留）
- BLOB 存 `Float32Array` 的 little-endian 字节序，128 维 = 512 字节/条

### 测试

- `embedding.test.ts`：
  - `embed("x")` 100 次 byte-identical
  - `embed("白璃")` 与 `embed("白璃姑娘")` cosine > 0.3
  - `embed("白璃")` 与 `embed("修炼")` cosine < 0.5
  - `embedBatch` 等价于 N 次 `embed`
- `memoryStore.test.ts` 扩：
  - `retrieveRelevantMemories` top-k 排序正确
  - 历史无 embedding 行被懒回填，retrieve 后行有 BLOB
  - 同 NPC 隔离、跨 session 隔离

### 阶段 4a 完成定义

- [ ] EmbeddingProvider 接口 + hash 实现可用
- [ ] memoryStore 新 API 单测全过
- [ ] 旧测试全部仍绿
- [ ] `addMemory` 后续 read 速度 < 50ms（含 cosine 计算）

---

## 阶段 4b — promptBuilder 混合检索 + debug API（1-2 天）

**目标**：把 retrieve 接入对话主链路。每轮按玩家输入检索相关记忆，与最近 buffer 合并去重；新 debug API 让用户能看到检索效果。**前端零改动**，curl 验收。

### 可验证交付

- `curl /api/debug/memory/:sessionId/:npcId?q=...&k=5` 返回 `{ retrieved: [{content, score}], recent: [...] }`
- 同 NPC 累计 50+ 条记忆后，发"丹药"相关话题 → prompt 召回相关旧记忆
- 单测：promptBuilder 调用 retrieve 时传入正确参数
- chatRoute 测试扩：mock 模式下，retrieve 结果包含在 userTurn 文本里

### 改写文件

- `server/src/services/promptBuilder.ts`:
  - `buildUserTurn` 增加可选参数 `memoryRetriever?: (query, npcId) => Promise<string[]>`
  - 调用方传入：`async (q, n) => mergeMemories(retrieveRelevant(n, q, 5), getRecentMemories(n, 3))`
  - 合并策略：retrieve 优先 + recent 补到 5 条上限，按 id 去重
- `server/src/routes/chat.ts`:
  - 计算 prompt 前先 `await` retrieve（hash provider 是同步，但接口签名 async 为未来 OpenAI 留口子）
  - 注入 memories 到 buildUserTurn

### 新建文件

- `server/src/routes/debug.ts` — `GET /api/debug/memory/:sessionId/:npcId?q=...&k=5`
- 挂载到 `index.ts`，**仅 `NODE_ENV !== "production"` 时启用**（或 env `ENABLE_DEBUG_API=true`）

### 测试

- `promptBuilder.test.ts` 扩：传入 retriever 函数时，userTurn 包含返回的记忆
- `chatRoute.test.ts` 扩：连续 5 轮对话后，第 6 轮包含早期记忆
- `debugRoute.test.ts`（新）：q + k 参数正确，返回相似度排序

### 阶段 4b 完成定义

- [ ] retrieve 在 chat 链路里实际生效
- [ ] debug API 可用
- [ ] buildSystemPrompt 仍 byte-identical（caching 不变）
- [ ] mock 下 50 条记忆 retrieve < 20ms

---

## 阶段 4c — personalityEvolution + 记忆水晶页（2-3 天）

**目标**：NPC personality 不再静态。累计 state_delta + 重大事件触发 `evolved_traits`，注入 prompt。前端记忆水晶页面展示。

### 可验证交付

- 玩家在白璃面前威胁 5 次后，白璃 personality 多一条"暧昧的迟疑"或"对玩家警觉"
- `GET /api/personality/:sessionId/:npcId` 返回当前演化的 traits
- `/memory` 页面渲染：当前 NPC 的 evolved_traits + top-10 memories + 相似度
- 玩家重置 NPC 时（POST /api/chat/reset）evolved_traits 清空
- `POST /api/debug/personality/revert` 可重置某 NPC 演化（仅 debug 模式）

### DB 新增

- `server/src/db/migrations/004_personality.ts`:
  ```sql
  CREATE TABLE npc_personality (
    session_id TEXT NOT NULL,
    base_npc_id TEXT NOT NULL,
    evolved_traits_json TEXT NOT NULL DEFAULT '[]',
    counters_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, base_npc_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
  ```
- `counters_json` 是累计器：`{threats: 3, gifts: 1, refused_trades: 2, ...}`
- `evolved_traits_json` 是已触发的 trait 字符串数组

### 新建文件

- `server/src/data/evolutionRules.ts` — 规则表：
  ```typescript
  type EvolutionRule = {
    id: string;
    npcId: string;                   // 对哪个 NPC
    requires: Partial<Counters>;     // counters 阈值
    addsTrait: string;               // 触发后加入 evolved_traits
    once: boolean;                   // 是否只触发一次
  };
  ```
  示例：
  - `baili_threats >= 5` → "对玩家警觉"
  - `baili_completed_quests >= 1` → "暧昧的迟疑"
  - `chimu_refused_tolls >= 3` → "记仇等机会"
- `server/src/services/personalityEvolution.ts`:
  - `recordEvent(sessionId, npcId, event: PersonalityEvent)` — 累计 counters
  - `evaluateRules(sessionId, npcId)` — 检查阈值，写 evolved_traits
  - `getEvolvedTraits(sessionId, npcId): string[]`
  - `resetPersonality(sessionId, npcId)`
- `server/src/routes/personality.ts` — GET/DELETE
- `client/src/pages/MemoryCrystalPage.tsx`
- `client/src/api/memoryApi.ts` / `personalityApi.ts`

### 改写文件

- `server/src/routes/chat.ts`:
  - response 处理完后调 `personalityEvolution.recordEvent`（基于 intent + state_delta）
  - `personalityEvolution.evaluateRules` 同步触发
- `server/src/services/promptBuilder.ts`:
  - `buildSystemPrompt` 加入 evolved_traits 到角色卡末尾（"额外人格演化：..."）
  - **注意**：buildSystemPrompt 接收的 evolved_traits 改为参数，但同 NPC + 同 traits 集合输出仍 byte-identical（caching 不破）
- `client/src/App.tsx` — 加 `/memory` 路由
- `client/src/state/store.ts` — 加 evolvedTraits slice
- `client/src/components/SceneBackdrop.tsx` — 顶部加入口到 MemoryCrystalPage

### 触发事件设计

| event | 触发条件 | counter ++ |
|---|---|---|
| `player_threatens` | intent=refuse_service + state_delta.anger > 5 | threats |
| `player_completes_quest` | questEngine status → completed | completed_quests |
| `player_fails_quest` | questEngine status → failed | failed_quests |
| `player_offers_gift` | intent=complete_trade + 含特定 keyword | gifts |
| `player_reported` | intent=report_player | reports |

### 测试

- `personalityEvolution.test.ts`：5 条规则全部触发路径 + revert
- `personalityRoute.test.ts`：GET / DELETE 端到端
- 前端 `MemoryCrystalPage.test.tsx`：渲染 + 数据空态 + NPC 切换
- chatRoute 扩：连续 5 次威胁后 GET evolvedTraits 含新 trait

### 阶段 4c 完成定义

- [ ] 5 条 evolution rule 单测全通
- [ ] 玩家可在记忆水晶页看到当前 NPC 的 evolved_traits 和 top 记忆
- [ ] prompt 实际包含 evolved_traits
- [ ] buildSystemPrompt 在 traits 不变时仍 byte-identical
- [ ] 旧测试全绿

---

## 决策点

> 默认值已选定（用户在启动时确认），列出供后续调整参考。

**决策点 A — 向量后端**：✅ hash-based 占位 + 可插拔接口（已选）。代价：相似度不如真 embedding，但 0 依赖、Windows 友好、可单测。后续切 OpenAI 只需新增 `openaiProvider.ts`。

**决策点 B — embedding 维度**：默认 128（不是 768）。理由：hash 方案信号有限，维度高也不会更好；128 维 BLOB 512 字节，10k 条记忆才 5MB。OpenAI text-embedding-3-small 是 1536 维，切换时改 dim 即可。

**决策点 C — evolved_traits 是否影响 LLM 响应风格**：是。注入 buildSystemPrompt 末尾"额外人格"段。代价：同 NPC 跨 session 不再 byte-identical，但同 (npcId, traits) 仍 identical（caching 仍按 (npcId, traits-set hash) 做）。

**决策点 D — personality 重置粒度**：per-(session, npcId)。`POST /api/chat/reset` 已是 per-NPC，此处复用。**不**做 per-session 一键重置（留 4c 后续）。

**决策点 E — 记忆 retrieve 时 LRU 截断**：现 LRU 上限 20。改为软上限 100（保留长期记忆做 retrieve），但**每 NPC 不超过 1000**（防爆库）。

---

## 阶段 4 风险

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| **hash embedding 召回质量差** | "丹药" 与 "tea pill" 没有语义关联 | hash 方案明确告知用户是"占位"，UI 标注；阶段 4 不追求质量上限 |
| **LRU 100 写爆** | 长 session 累计太多记忆 | 每 NPC 写时 LRU 截断到 100；retrieve 限 query 时间 < 50ms |
| **evolution 触发太频繁** | 单局对话过短就触发 | rules 阈值至少 3 次同类事件 |
| **prompt token 暴涨** | top-5 retrieved + 3 recent + evolved_traits | retrieved 截断每条 ≤ 30 字；evolved_traits ≤ 5 条 |
| **byte-identical 破坏** | evolved_traits 改 buildSystemPrompt | 入参化 traits，仅同 (npcId, traits-hash) byte-identical |
| **migration 破老库** | `npc_personality` 表加列 | 4c migration 用 `CREATE TABLE IF NOT EXISTS`；老 session 默认空 traits |
| **debug API 暴露** | 生产环境留 /api/debug | 仅 `NODE_ENV !== "production"` 或 `ENABLE_DEBUG_API` 时挂载 |

---

## 阶段 4 **不做** 清单

- **不接 OpenAI**：embedding/personality 全本地，阶段 4 完成后再切。
- **不做 NPC 间后台事件**：NPC 仍只在玩家在场时响应。阶段 5 才有 backgroundEvents。
- **不改对话 message array 结构**：阶段 5 才上 prompt caching 真接入。
- **不做记忆"忘却"**：LRU 截断已足够，复杂的衰减模型阶段 6+。
- **不做 personality 可视化图**：MemoryCrystalPage 只列字符串。雷达图阶段 6。
- **不接 sqlite-vec / hnswlib-node**：占位胜过引入 native dep。

---

## 跨 sub-phase 接力

如果换 session / 换机器中途接手：

1. 看 git log: `phase-4a-*` / `phase-4b-*` / `phase-4c-*` 前缀
2. 跑 `cd server && npm test && cd ../client && npm test` 确认 baseline
3. 看 `server/src/services/embedding/` 是否存在 → 判断 4a 完成度
4. 看 `server/src/routes/debug.ts` 是否存在 → 判断 4b 完成度
5. 看 `server/src/services/personalityEvolution.ts` + `client/src/pages/MemoryCrystalPage.tsx` 是否存在 → 判断 4c

---

## Critical Files for Implementation

阶段 4 优先（按改动量降序）:

- `server/src/services/embedding/hashProvider.ts`（新，0 依赖、确定性、可测）
- `server/src/services/memoryStore.ts`（加 retrieve + backfill）
- `server/src/services/personalityEvolution.ts`（新，状态机 + counters）
- `server/src/services/promptBuilder.ts`（注入 retrieved memories + evolved_traits）
- `client/src/pages/MemoryCrystalPage.tsx`（新，玩家可见）
