# 阶段 3 — 多 NPC + 场景 + 任务系统 · 实施计划

> 本文件是 `docs/IMPLEMENTATION_PLAN.md` 阶段 3 的执行级展开，独立成档，不动主计划。所有路径相对项目根。
> 阶段 1+2 已合入 commit `1ecb225` + `7a30d29`，本计划在该 baseline 上推进。

## Context

阶段 1+2 完成后，白璃单 NPC + 修真数值闭环已 production-ready。阶段 3 把"只有白璃"扩成 **多 NPC + 多场景 + 任务系统**，M→L scope，6-8 天。

### 当前代码现状 (相对主计划的偏移)

逐文件 review 后发现的偏移项，在本计划中已对齐:

| 主计划描述 | 实际代码 | 处理 |
|---|---|---|
| 阶段 1 预埋 `react-router-dom` 包装 BrowserRouter | 包已装 (`^7.15.1`)，但 `main.tsx` 没 wrap，没 pages 目录 | 阶段 3c 引入 BrowserRouter |
| `server/src/data/npcs.json` 移 npc profiles | `data/` 现存 `.ts` 文件 (alchemyRecipes / items / techniques) | 沿用 `.ts` 模块约定: `data/npcs.ts`、`data/scenes.ts`、`data/quests.ts` |
| `executeIntent` 改为查 `quests.json` 的 `intent→effect` | 当前 `executeIntent` 把所有 intent (含 trade / refuse / report) 一把抓 | 拆出 questEngine 处理 quest 类 intent，其余仍走 gameState.executeIntent (见 §4) |
| 阶段 2 任务: 拆 `complete_trade / teach_technique` | 已完成，IntentType 已含这两个 | skip，直接进 quest 扩展 |
| session.ts 接管多 NPC 状态拉取 | `session.ts:46` 硬编码 `::baili` | 阶段 3a 改为遍历当前场景的 NPC 集合 |
| `responseValidator.ts:133-150` 白名单 quest_id / technique_id | 写死字符串 "steal_inspector_key" / "basic_breathing" | 阶段 3b 改为查 `quests.ts` / `techniques.ts` 的注册表 |
| chatApi.ts 默认 `npcId="baili"` + store.ts `const NPC_ID = "baili"` | 仍是单 NPC 假设 | 阶段 3c 删除默认，由 store 维护 activeNpcId |

### 阶段 3 范围 (不变)

- 4 NPC: 白璃 / 苏鹤 / 赤目 / 青姑 (角色卡 + mock + state 初值)
- 4 场景: 无相黑市 / 监察院外围 / 雷罚酒馆 / 玩家洞府
- DB: `quest_progress` / `npc_relations` / `active_scene` (scenes 本身留 data 模块，不入 DB)
- 任务状态机 + 数据驱动 quest 效果
- promptBuilder 拆 system / user (为阶段 5 caching 铺路)
- 前端 react-router + 场景切换 + NPC 列表 + 任务日志

---

## 总体策略 · 三个独立可发布的 sub-phase

每个 sub-phase **独立可测**，可作为一次 session 的停止点。中断后下次开新 session 拿 git log 就能续。

```
3a — 数据层 + 类型 + DB schema      (1-2 天)  ← 后端独立, npm test 全绿即收
3b — questEngine + promptBuilder 拆分 (2-3 天)  ← 后端 API 完成, 4 NPC 可单测对话
3c — 前端路由 + 场景/NPC/任务 UI    (2-3 天)  ← 浏览器能切场景、点 NPC、看任务
```

总计 5-8 天，与主计划 6-8 天估算一致。

---

## 阶段 3a — 数据层 + 类型 + DB schema (1-2 天)

**目标**: 后端把 4 NPC、4 场景、quest 元数据全部落地，数据库表建好，类型完整，现有 `npm test` 不破。**前端零改动**。

### 可验证交付

- `cd server && npm test` 全绿 (旧测试 + 新 gameState/sceneStore/questStore 单测)
- `curl -X POST localhost:3001/api/session` 返回包含全部场景下所有 NPC 初始 state 的快照
- `curl /api/scenes` 返回 4 个场景的 metadata
- 直接 `sqlite3 game.db ".tables"` 看到 `quest_progress / npc_relations / active_scene` 三张新表
- 旧前端启动仍然能跟白璃对话，一切如旧 (兼容性闸门)

### 新建文件

**数据**
- `server/src/data/npcs.ts` — 4 个 NpcProfile 导出为 `Record<string, NpcProfile>`，含 baili / suhe / chimu / qinggu。结构与现有 `npcProfiles` 完全一致，新增字段见下面 type 扩展。
- `server/src/data/scenes.ts` — `Record<string, SceneDefinition>` 共 4 场景:
  ```typescript
  type SceneDefinition = {
    sceneId: string;
    name: string;
    description: string;        // 200 字以内, 渲染场景背景文案
    backgroundAsset: string;    // placeholder 路径, 如 "/scenes/black-market.png"
    npcIds: string[];           // 在场 NPC base_npc_id 列表
    unlockedByDefault: boolean; // 是否初始可达
  };
  ```
- `server/src/data/quests.ts` — `Record<string, QuestDefinition>`，至少 3 条 quest，见 §4 questEngine 设计。包含 `steal_inspector_key` (从 hardcode 迁出) + 2 条跨 NPC quest。
- `server/src/data/npcInitialRelations.ts` — NPC 间初始 trust/hostility 矩阵 (二维 record)。

**Service / Repository**
- `server/src/services/sceneStore.ts` — `getSceneById / getAllScenes / getNpcsInScene(sceneId)`。纯数据查询，不写表。
- `server/src/services/questStore.ts` — `getQuestProgress(sessionId, questId) / getAllQuestProgressForSession(sessionId) / upsertQuestProgress(...)`。SQLite 直读写，不含状态机逻辑 (那是 questEngine 的活)。
- `server/src/services/npcRelationsStore.ts` — `getRelation(fromNpc, toNpc, sessionId) / applyRelationDelta(...)`。session 维度 (每个 session 一份 NPC 关系演化记录，类似 npc_states 的 scoped 模式)。

**Types**
- `server/src/types/scene.ts` — `SceneDefinition / SceneSnapshot` (snapshot 含 NPC state 集合，给前端用)。
- `server/src/types/quest.ts` — `QuestDefinition / QuestProgress / QuestStatus = "available" | "accepted" | "in_progress" | "completed" | "failed"`。
- `server/src/types/relations.ts` — `NpcRelation { fromNpc, toNpc, trust, hostility }`。

**DB**
- `server/src/db/migrations/003_world.ts`:
  ```sql
  CREATE TABLE quest_progress (
    session_id TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    status TEXT NOT NULL,              -- available | accepted | in_progress | completed | failed
    progress_json TEXT NOT NULL DEFAULT '{}',  -- 阶段性 flag, e.g. {"key_stolen": true}
    accepted_at TEXT,
    completed_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, quest_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE npc_relations (
    session_id TEXT NOT NULL,
    from_npc TEXT NOT NULL,
    to_npc TEXT NOT NULL,
    trust INTEGER NOT NULL DEFAULT 0,
    hostility INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (session_id, from_npc, to_npc),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE active_scene (
    session_id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_quest_progress_session ON quest_progress(session_id);
  CREATE INDEX idx_npc_relations_session ON npc_relations(session_id);
  ```
  注: `scenes` / `npc_scene` 表**不**入 DB——这些是静态数据，放 `data/scenes.ts` 即可，避免 migration 与 code 同步成本。**`active_scene`** 入 DB 因为这是 per-session 运行时状态。
- `server/src/db/migrations/index.ts` — append `{ version: "003_world", run: runWorldMigration }`。

### 改写文件

- `server/src/services/gameState.ts` — 删除模块级 `npcProfiles` / `initialNpcStates` const，改从 `data/npcs.ts` 导入。`getNpcProfile / getInitialState` 内部转向数据模块，签名零改动。
- `server/src/types/npc.ts` — 给 `NpcProfile` 加可选字段:
  ```typescript
  type NpcProfile = {
    // ...existing
    initialState: NpcState;          // 初始 trust/fear/anger/tianDaoAlert, 从 initialNpcStates 搬过来
    sceneIds?: string[];             // 常驻场景 (冗余, 主索引仍在 scenes.ts)
    mockResponderTag?: string;       // 阶段 3b 用, e.g. "baili" → 选 mockResponders/baili.ts
  };
  ```
- `server/src/routes/session.ts:46` — 删除硬编码 `::baili`。改为:
  ```typescript
  // 拉取该 session 在所有 base NPC 上的 state (按需 lazy init)
  const allNpcStates = getAllNpcStatesForSession(session.sessionId);  // 新增 gameState 函数
  const activeScene = getActiveScene(session.sessionId) || DEFAULT_SCENE_ID;
  ```
  Session 响应体新增 `npcStates: Record<string, NpcState>` (代替原 `npcState`，后者保留作 deprecated 字段指向当前 active NPC 的 state，一个 sub-phase 后删)。
- `server/src/services/playerStore.ts` — `createSession` 时除创建 player，也写入 `active_scene` 默认为 `"black_market"`。

### 测试

- `server/src/__tests__/sceneStore.test.ts` — 加载 4 场景，校验 npcIds 都能在 `data/npcs.ts` 找到。
- `server/src/__tests__/questStore.test.ts` — upsert / get round-trip，status 枚举校验，FK 删除级联。
- `server/src/__tests__/migrations.test.ts` — 新 migration 在干净 DB / 已存在 DB 都幂等。
- 修订 `gameState.test.ts` — npcProfiles 来源切到 data 模块后旧 assertion 仍过。
- 修订 `chatRoute.test.ts` — 现有 baili 路径不变，新增 suhe / chimu / qinggu 各一发请求确保 404 路径关掉，NPC 都认得。

### 阶段 3a 完成定义

- [ ] 所有新表存在
- [ ] `data/npcs.ts` 4 个 profile，`data/scenes.ts` 4 场景，`data/quests.ts` 至少 3 条
- [ ] `getNpcProfile("suhe")` 不抛
- [ ] 旧 baili 单 NPC 对话仍正常，旧前端零改动可跑
- [ ] `npm test` 全绿

---

## 阶段 3b — questEngine + promptBuilder 拆分 (2-3 天)

**目标**: questEngine 上线，executeIntent 数据驱动化; promptBuilder 拆分为 `buildSystemPrompt(npcId)` + `buildUserTurn(state, memories, input, player, scene)`; mockResponders 按 NPC 拆 4 份。**前端仍零改动** (但 API 已支持多 NPC)，用 curl 跑通 4 NPC 对话即收。

### 可验证交付

- `curl -X POST /api/chat -d '{"npcId":"suhe","sessionId":"...","playerInput":"..."}'` 4 NPC 全部返回风格各异的 mock 回复
- `curl /api/quests/:sessionId` 返回当前 session 的全部 quest 状态
- `curl -X POST /api/scene/switch -d '{"sessionId":"...","sceneId":"thunder_tavern"}'` 切换场景
- mock 模式下走过一条 quest 流: `give_quest` → state 变 `accepted` → 触发 `complete_quest` intent → state 变 `completed` + 灵石/物品发放
- 单测覆盖 questEngine 全部 5 个 status 转移 + intent→effect 白名单
- promptBuilder 单测: 同 npc 不同 turn 时 `buildSystemPrompt` 输出 byte-for-byte 相同 (caching 前置条件)

### 4.1 promptBuilder 拆分设计

**当前**: 单函数 `buildPrompt({ npcId, scopedNpcId, playerInput, memories, player })` 把角色卡 + 示范 + 硬性规则 + 当前情境 + 玩家输入全部拼成一个 string。

**拆分后**:

```typescript
// server/src/services/promptBuilder.ts
type SystemPromptInput = {
  npcId: string;                   // base NPC id, 决定角色卡
  scenePeers?: ScenePeerSummary[]; // 同场景其他 NPC 简介 (≤ 30 字/个)
};

type UserTurnInput = {
  scopedNpcId: string;
  playerInput: string;
  memories: string[];
  player: PlayerState;
  npcState: NpcState;
  activeQuests: QuestProgress[];   // 该 NPC 相关的进行中 quest
  scene: SceneSnapshot;            // 场景背景, 在场 NPC 列表
};

export function buildSystemPrompt(input: SystemPromptInput): string;  // 静态: 角色卡 + 示范 + 硬性规则
export function buildUserTurn(input: UserTurnInput): string;          // 动态: 情境 + 输入

// 兼容层 (一个 sub-phase 后删):
export function buildPrompt(...): string {
  return buildSystemPrompt(...) + "\n\n" + buildUserTurn(...);
}
```

**拆分原则** (字面 cut，主要是把 promptBuilder.ts 现在的 string 横向切):

- `buildSystemPrompt` 包含: `# 角色卡` / `# 可执行的内部意图` / `# 几个示范` / `# 硬性输出规则` — **这部分对同一 NPC 跨 turn 不变**，阶段 5 给它打 `cache_control: { type: "ephemeral" }`。
- `buildUserTurn` 包含: `# 当前情境` (NPC state / 玩家叙事 / 记忆 / 场景背景 / 在场 NPC / 进行中 quest) + `# 玩家输入`。

**4 NPC 的角色卡分块**: 每个 NPC 自己的角色卡放 `server/src/services/promptParts/{baili,suhe,chimu,qinggu}.ts`，每个 export 一个 `getRoleCard(): string` + `getExemplars(): string`。`buildSystemPrompt` 按 npcId 选段拼接。

**阶段 5 caching 钩子**: `buildSystemPrompt` 返回结构后续从 `string` 升级为 `Array<{type:"text", text:string, cache_control?:...}>`，当前阶段先保持 string，但 **保证同 npcId 调用幂等且 byte-identical** (无时间戳、无随机)。该不变量由单测把关。

### 4.2 questEngine 状态机设计

**表 shape (已在 3a)**:
```
quest_progress: (session_id, quest_id, status, progress_json, accepted_at, completed_at, updated_at)
```

**QuestDefinition** (`data/quests.ts`):
```typescript
type QuestDefinition = {
  questId: string;
  title: string;
  description: string;
  giverNpcId: string;                          // 派任务的 NPC
  involvedNpcIds: string[];                    // 完成时会被影响的 NPC 列表
  acceptableViaIntent: IntentType;             // 通常是 "give_quest"
  completionTriggers: QuestTrigger[];          // 满足任一即可完成
  effectsOnAccept: QuestEffect[];              // 接受时立即结算
  effectsOnComplete: QuestEffect[];            // 完成时结算
  effectsOnFail: QuestEffect[];                // 失败时结算
};

type QuestTrigger =
  | { kind: "intent"; intentType: IntentType; npcId: string }           // NPC X 触发指定 intent
  | { kind: "flag"; key: string; expectedValue: unknown }               // progress_json 中某 key 满足
  | { kind: "npc_state_threshold"; npcId: string; field: keyof NpcState; op: ">=" | "<="; value: number };

type QuestEffect =
  | { kind: "npc_state_delta"; npcId: string; delta: Partial<NpcStateDelta> }
  | { kind: "relation_delta"; from: string; to: string; trust?: number; hostility?: number }
  | { kind: "give_item"; itemId: string; quantity: number }
  | { kind: "give_stones"; amount: number }
  | { kind: "set_flag"; key: string; value: unknown };
```

**状态转移规则**:
```
                        give_quest intent
[available] ────────────────────────────────────► [accepted]
                                                       │
                                          first effect / first turn
                                                       │
                                                       ▼
                                              [in_progress]
                                                  │      │
                                completionTriggers      failTriggers
                                  matched                matched
                                     │                      │
                                     ▼                      ▼
                              [completed]              [failed]

非法转移 (例: completed → in_progress) 一律抛 QuestStateError, 由 questEngine.advance 捕获并 log。
```

**questEngine API**:
```typescript
// server/src/services/questEngine.ts
export function evaluateIntent(
  sessionId: string,
  scopedNpcId: string,
  intent: NpcIntent
): { actionResults: string[]; effectsApplied: QuestEffect[] };

export function getRelevantQuests(sessionId: string, npcId: string): QuestProgress[];
```

**executeIntent 重构** (重要):

当前 `gameState.executeIntent` 单 switch 处理 7 种 intent。拆成 2 层:

```typescript
// gameState.executeIntent 只剩"非 quest"intent (trade / refuse / report):
export function executeIntent(scopedNpcId: string, intent: NpcIntent): string {
  if (intent.type === "offer_trade") return "已打开黑市丹药交易。";
  if (intent.type === "complete_trade") return "交易已记录, 具体物品以背包结算为准。";
  if (intent.type === "teach_technique") return resolveTechniqueIntent(intent);
  if (intent.type === "refuse_service") return "该 NPC 拒绝继续交易。";  // 改通用文案
  if (intent.type === "report_player") { applyAlertDelta(...); return "..."; }
  // give_quest 不再在这里处理:
  return "";
}

// chat.ts route 改为同时调两个:
const baseResult = executeIntent(scopedNpcId, npcResponse.intent);
const questEval = questEngine.evaluateIntent(sessionId, scopedNpcId, npcResponse.intent);
const actionResult = [baseResult, ...questEval.actionResults].filter(Boolean).join(" / ");
```

这样 **两者职责清晰**:
- `gameState.executeIntent` — 通用 NPC 业务效果 (跟 quest 无关的)
- `questEngine.evaluateIntent` — 基于 quests.ts 数据判断: 该 intent 是否启动/推进/完成某个 quest

**为何不全替**: refuse / report / offer_trade 这类是"NPC 行为"而非"任务驱动"，不该塞 quests.ts; 否则每次加 NPC 都要造空 quest 记录。

### 4.3 mockResponders 按 NPC 拆

`llmClient.ts` 当前 `createMockResponse` 整段移到:
- `server/src/services/mockResponders/index.ts` — 总入口 `getMockResponder(npcId): (input) => ValidatedNpcResponse`
- `server/src/services/mockResponders/baili.ts` — 现有 4 分支搬来
- `server/src/services/mockResponders/suhe.ts` — 卧底，假装中立掮客，关键词 "监察院/线人" 时 anger 暗升 + memory 暗记
- `server/src/services/mockResponders/chimu.ts` — 雷罚帮打手，默认 hostility 高，关键词 "雷罚/挑衅" 触发 refuse_service + anger
- `server/src/services/mockResponders/qinggu.ts` — 信息贩子，offer_trade 主导，"苏鹤/卧底" 关键词触发特殊 give_quest

`llmClient.generateNpcResponse` 多接一个 `npcId` 参数 (向下兼容: 默认 baili，实际 chat.ts 始终传)。

### 改写文件 (3b)

- `server/src/services/gameState.ts` — `executeIntent` 瘦身 (见上)
- `server/src/services/llmClient.ts` — `generateNpcResponse(prompt, playerInput, npcId)`; mock 分支替换为 `getMockResponder(npcId)(playerInput)`
- `server/src/services/promptBuilder.ts` — 拆函数 (见 §4.1)
- `server/src/services/responseValidator.ts:133-150` — 白名单查 `getQuestDefinition(quest_id)` / `getTechnique(technique_id)`，失败回 `{ type: "none", params: {} }`。删除字面常量。
- `server/src/routes/chat.ts` — 双调 executeIntent + questEngine.evaluateIntent; sceneId 从 active_scene 读取并填入 prompt; `addMemory` 加 if-not-empty guard (顺手修)
- 新建 `server/src/routes/scene.ts` — `POST /api/scene/switch { sessionId, sceneId }` + `GET /api/scenes`
- 新建 `server/src/routes/quest.ts` — `GET /api/quests/:sessionId`
- `server/src/index.ts` — 挂载新 router

### 测试 (3b)

- `questEngine.test.ts` — 全部 5 状态转移，非法转移抛错，effect 累加，flag-based trigger
- `mockResponders/{baili,suhe,chimu,qinggu}.test.ts` — 各 NPC 关键词分支
- `promptBuilder.test.ts` — `buildSystemPrompt("baili")` 调 100 次输出 byte-identical; `buildUserTurn` 含动态 state / memories / scene
- `chatRoute.test.ts` 扩 — 4 NPC 各发一条，quest 全流程 (give → in_progress → 触发 complete)

### 阶段 3b 完成定义

- [ ] 4 NPC mock 对话风格区分明显 (手测 + 单测)
- [ ] 一条跨 NPC quest 流通 (mock 模式 curl 跑通)
- [ ] `buildSystemPrompt` 幂等可缓存性单测过
- [ ] `responseValidator` 不再有字符串字面 quest_id / technique_id

---

## 阶段 3c — 前端路由 + 场景/NPC/任务 UI (2-3 天)

**目标**: 前端 react-router 拆 Pages，加场景切换器、NPC 列表、任务日志面板; store 增 scene / activeNpcId / quest slice。

### 可验证交付

- 浏览器看到顶部场景切换器 (4 个 tab)，点击切换 URL `/play/scene/black_market` → `/play/scene/thunder_tavern`
- 切场景后中间面板的 NPC 列表更新，点 NPC 头像进入对话
- 任务日志 (右下) 显示 accepted / in_progress quests，hover 见 description
- 跨 NPC 演示: 在青姑处接 "印证苏鹤身份" quest → 切到监察院外围找苏鹤说挑衅话 → 任务面板状态变化
- 重置/多 session 不破
- `cd client && npm test` 全绿

### 4.1 React Router 结构

```
client/src/App.tsx → 只做 layout shell + <BrowserRouter> wrap
client/src/main.tsx → root render

新增 pages:
client/src/pages/PlayPage.tsx       — 主对话页 (含 SceneSwitcher + NpcList + Dialogue)
client/src/pages/SettingsPage.tsx   — 设置 / 重置 / debug
client/src/pages/NotFoundPage.tsx   — 404

路由表:
/                       → redirect /play
/play                   → PlayPage (默认场景)
/play/scene/:sceneId    → PlayPage (URL 驱动 scene)
/settings               → SettingsPage
```

**为何 SettingsPage 先做**: 主计划列了它，现实里阶段 3 内容主要在 PlayPage; SettingsPage 只挂"重置存档 / 切换 mock / 显示 sessionId"3 个按钮，1 小时内完成。**决策点 C** 见下。

### 4.2 新建 / 改写文件

**新建组件**
- `client/src/pages/PlayPage.tsx` — 拆自 App.tsx
- `client/src/pages/SettingsPage.tsx` — 最小可行
- `client/src/components/SceneSwitcher.tsx` — 顶部 4 个 tab，通过 `useNavigate()` + `useParams()` 联动 URL
- `client/src/components/NpcListPanel.tsx` — 当前场景的 NPC 列表，点击 `setActiveNpcId`
- `client/src/components/QuestLog.tsx` — 显示 accepted / in_progress quest 卡片
- `client/src/components/SceneBackdrop.tsx` — placeholder 渐变色 + 场景名渲染 (不做真图)
- `client/src/api/sceneApi.ts` — `listScenes` / `switchScene`
- `client/src/api/questApi.ts` — `listQuests`

**改写**
- `client/src/main.tsx` — 包 `<BrowserRouter>`
- `client/src/App.tsx` — 变成 layout shell，渲染 `<Outlet />`，删大量内容 (迁到 PlayPage)
- `client/src/state/store.ts` — 删除 `const NPC_ID = "baili"`，增 slice:
  ```typescript
  // 新增 state
  activeSceneId: string;
  activeNpcId: string;
  npcStates: Record<string, NpcState>;      // 替代 npcState (单 NPC 字段)
  quests: QuestProgress[];

  // 新增 actions
  switchScene: (sceneId: string) => Promise<void>;
  selectNpc: (npcId: string) => void;
  refreshQuests: () => Promise<void>;
  ```
  `sendMessage` 改用 `get().activeNpcId` 代替 `NPC_ID`; `resetDialogue` 同。
- `client/src/api/chatApi.ts` — 删 `npcId = "baili"` 默认值，改 required
- `client/src/api/sessionApi.ts` — `SessionResponse` 加 `activeSceneId` + `npcStates` 字段，normalizer 同步

### 4.3 store slice 命名规范

照阶段 1+2 的 zustand 单 store + flat 命名约定 (`cultivationLoading / breakthroughLoading / alchemyLoading`)，不引入 slice 拆分库。新增字段平铺到 GameState:

```typescript
type GameState = {
  // ...existing
  activeSceneId: string;
  activeNpcId: string;
  scenesLoading: boolean;
  questsLoading: boolean;
  npcStates: Record<string, NpcState>;   // key = base npcId (非 scoped)
  quests: QuestProgress[];
  scenes: SceneDefinition[];             // metadata cache, 启动时一次性拉
};
```

### 测试 (3c)

- `App.test.tsx` 重写 — wrapped in MemoryRouter，默认进 `/play`
- 新增 `PlayPage.test.tsx` — 场景切换 / NPC 切换 / 任务面板渲染
- 新增 `SceneSwitcher.test.tsx` — URL ↔ activeSceneId 双向同步
- store 测试 — `switchScene` 不会清空 messages (per-NPC dialogue 持久化)

### 阶段 3c 完成定义

- [ ] URL 驱动场景切换可用
- [ ] 4 NPC 在不同场景下点击能对话 (mock 模式即可)
- [ ] 任务面板有内容 (mock 模式下接受一条 quest 后)
- [ ] 重置 / 刷新 / 多 session 不破
- [ ] 前后端测试全绿

---

## 5. 留给用户审阅的决策点

> 开工前先定下来。

**决策点 A — 4 NPC 一次性 vs 先做 2 个?**
默认: 4 NPC 一次性接入 (mock 拆 4 份，角色卡写 4 份)。代价: 阶段 3b 多花半天写 mock + 角色卡。**备选**: 阶段 3 只做 baili + suhe (黑市 + 监察院，够演示卧底主线)，chimu / qinggu 推到阶段 6 主线展开时再加。**推荐 A1 (4 个一起)**，否则阶段 3c 的场景切换器只 2 个 tab 显得空。

**决策点 B — gameState.executeIntent 保留 vs 全替?**
默认: **保留 gameState.executeIntent 处理通用 NPC 行为 (trade/refuse/report/teach)，仅 give_quest 路由到 questEngine**。理由见 §4.2。**备选**: 把 executeIntent 全部废掉，任何 intent → 查 quests.ts 的 effect 表; 代价是要为每个普通 NPC 行为造空 quest，数据噪音。**推荐 B1 (保留, 双引擎)**。

**决策点 C — react-router 是否阶段 3 就引入 SettingsPage?**
默认: **是, 只挂 3 个按钮**。理由: 阶段 4-6 (向量记忆 / 法宝 / 存档分支) 都需要二级页，现在就把 Router 结构定下来比阶段 4 重构便宜。**备选**: 只做 PlayPage，阶段 4 再补 Router。**推荐 C1 (先做骨架)**。

**决策点 D — 多 NPC 跨 session reset 怎么处理?**
当前 `POST /api/chat/reset` 是 per-(sessionId, npcId) 重置一个 NPC 的 state + memory。阶段 3 后用户可能想"全场景一键重置"。**两种方案**:
- D1: 保留 per-NPC reset，加 `POST /api/session/:id/reset` 重置该 session 所有 NPC + quests
- D2: 改 `/api/chat/reset` 支持 `npcId: "*"`

**推荐 D1** (路由职责清晰，不污染 chat namespace)。

---

## 6. 阶段 3 风险

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| **prompt token 暴涨** | `buildUserTurn` 把所有场景 NPC 简介都塞 | 同场景 ≤ 3 NPC，简介 ≤ 30 字，总 user turn 增量控 < 300 tokens |
| **scope creep 进 UI map** | "做了场景为啥不做地图" | 严格 §3 边界: 场景 = 一张渐变背景 + 场景名 + 200 字描述，**不做格子 / 立绘 / 路径** |
| **mock LLM 4 NPC 漂** | 4 套 mock 容易随手乱写，风格趋同 | 每个 mockResponder.ts 顶部写 3-5 行风格 cheatsheet，同测试断言关键词 |
| **sceneLock 阶段 5 才用** | 阶段 3 加场景但没 lock，阶段 5 群聊接入需补 | 阶段 3 `active_scene` 表已预留 session-level scope; 阶段 5 加 sceneLock 字段时不需要 schema 改 |
| **quest_progress JSON 字段膨胀** | `progress_json` 无 schema | 文档约束 ≤ 8 个 flag，单测 reject 嵌套深度 > 2 |
| **questEngine 静默吞错** | intent 触发条件错配，用户看不到任何反馈 | actionResult 拼接所有 quest 副作用; 失败转移写 systemLog |
| **重构破回归** | gameState.executeIntent 拆分破单 NPC 路径 | 阶段 3a 完成定义里"旧 baili 流程零回归"是闸门 |

---

## 7. 阶段 3 **不做** 清单 (诱惑警告)

明确 **不在阶段 3 范围**，任何想动以下东西的冲动都属于 scope creep:

- **不接向量记忆**: NPC 记忆仍 `getRecentMemories(scopedNpcId, 5)`。embedding BLOB 列已在阶段 1 预留，阶段 4 才用。
- **不做 NPC 间后台事件**: NPC 离场没有自己活的。即"玩家不在场时苏鹤也不动"。阶段 5 才有 backgroundEvents。
- **不做群聊**: 同场景多 NPC 时玩家说话，只激活 `activeNpcId` 一个 NPC 回。其他 NPC 沉默。阶段 5 才有 groupChatOrchestrator。
- **不接 prompt caching**: `buildSystemPrompt` 输出 string，不打 `cache_control`。阶段 5 才升级到 messages array。
- **不做立绘 / CG / 地图**: 场景视觉只有渐变背景 + 文字。
- **不做存档分支**: 一个 session 一条线。阶段 6 才有 save_branches。
- **不做法宝 / 主线状态机**: 阶段 6 工作。
- **不做 NPC personality evolution**: NPC personality 字段静态，不写表。阶段 4 才有 evolved_traits。
- **不做关系演化 UI**: npc_relations 表落地 + API 暴露，但前端阶段 3 不渲染关系图。阶段 4 加可视化。

---

## 8. 跨 sub-phase 接力

如果换 session / 换机器中途接手:

1. 看 git log: commit message 用 `phase-3a-...` / `phase-3b-...` / `phase-3c-...` 前缀
2. 跑 `cd server && npm test && cd ../client && npm test` 确认 baseline
3. 看 `server/src/data/` 是否有 `npcs.ts / scenes.ts / quests.ts` → 判断 3a 完成度
4. 看 `server/src/services/questEngine.ts` 是否存在 → 判断 3b 完成度
5. 看 `client/src/pages/` 是否存在 → 判断 3c 完成度

---

## Critical Files for Implementation

阶段 3 优先 (按改动量降序):

- `server/src/services/questEngine.ts` (新建, §4.2 状态机核心)
- `server/src/services/promptBuilder.ts` (拆 system/user, §4.1 阶段 5 caching 前置)
- `server/src/services/gameState.ts` (executeIntent 瘦身 + npcProfiles 出搬)
- `client/src/state/store.ts` (删 NPC_ID 常量，加 scene/quest/activeNpcId slice)
- `client/src/App.tsx` (拆 Pages + react-router wrap)
