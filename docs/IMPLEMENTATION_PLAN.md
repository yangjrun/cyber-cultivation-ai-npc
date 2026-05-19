# 赛博修真 AI NPC → 完整对话驱动 AI RPG · 分阶段实施计划

> 本文件由 Plan Mode 生成,所有路径均为项目根(`cyber-cultivation-ai-npc/`)的相对路径,方便跨机器/跨 agent 接力执行。

## Context

本项目当前是一个**单 NPC 对话验证 demo**:玩家(陆玄)和黑市炼丹师白璃通过对话推进剧情,NPC 有 4 维状态 + 短期记忆(20 条字符串)+ 5 种 intent。修真元素几乎全是 flavor text——只有 `tianDaoAlert` 数值和 `steal_inspector_key` 任务 ID 真正驱动了机制,灵根/灵石/丹药/境界/雷罚都只是 prompt 里的术语。

**用户目标**:扩展成可分享的"对话驱动 AI RPG"网页 demo,同时推进四条线——
1. 修真数值系统(境界/灵根/功法/丹药/法宝)
2. 多 NPC + 关系网 + 场景 + 事件
3. AI 能力深化(向量记忆 / 人格演化 / 群聊 / NPC 间对话)
4. 玩家角色化(状态 / 物品 / 任务 / 成长)

部署形态:SQLite 持久化 + 多 session 隔离,Fly.io 单进程,**不做账号系统**。

**核心约束**:LLM 只负责对话与叙事;所有数值结算(修炼/炼丹/突破/关系演化)走纯规则,避免高频 LLM 调用炸 token。

## 总体策略

7 个阶段,每阶段独立可演示。**第 1 阶段就部署到公网**,后续每阶段都能直接 `git push` 让朋友试玩。LLM/规则分工的红线一旦定下,后期所有功能都按这个红线挂载。

```
阶段1: 基础设施 + 玩家骨架    (S→M)  ← 第一次部署
阶段2: 修真数值系统           (M)    ← 第一个完整反馈环
阶段3: 多 NPC + 场景 + 任务   (M→L)  ← 世界感
阶段4: 向量记忆 + 人格演化    (M→L)  ← NPC 真"活"
阶段5: 群聊 + NPC 间对话      (L)    ← 群像
阶段6: 主线剧情 + 法宝 + 结局  (M)    ← 通关体验
阶段7: 测试加固 + 可观测性    (S→M)  ← 抛光
```

---

## 阶段 1 — 基础设施 + 玩家骨架(S→M)

**目标**:内存 → SQLite,玩家从全局单例 → 每 session 一个角色,修复已知 bug,前端显示玩家自己的状态,部署到 Fly.io 拿到一条可分享 URL。

### 可验证交付
- `POST /api/session` 创建会话,返回 `{sessionId, playerId}`;刷新页面不丢档,重启后端不丢档
- 前端右上角出现「陆玄」玩家卡(名字 / 修为 / 灵石 / 灵气池占位)
- 多个浏览器开多个 session 完全隔离
- 一条 `https://...fly.dev` URL,首屏 < 3s
- `client/src/App.test.tsx` 全绿(修复 `App.test.tsx:82` 文案脱节)
- promptBuilder 能取到 session 已积累的 NPC state(修复已知 bug)

### 关键文件改动
**新建**
- `server/src/db/connection.ts` — `better-sqlite3` 单例,db 文件路径走 `DB_PATH` 环境变量
- `server/src/db/schema.sql` — 表:`sessions`、`players`、`npc_states`、`memories`(为后续阶段预留 `embedding BLOB` 列)
- `server/src/db/migrations/001_init.ts` — 首次启动建表
- `server/src/types/player.ts` — `PlayerProfile`(静态身份)+ `PlayerState`(运行时数值,字段占位:`spiritStones / qiCurrent / qiCap / cultivationStageIdx`)
- `server/src/services/playerStore.ts` — Repository:`createPlayer / getPlayer / updatePlayer`
- `server/src/routes/session.ts` — `POST /api/session` / `GET /api/session/:id`
- `server/src/schemas/chat.ts` — Zod schema 接替手写校验
- `client/src/state/store.ts` — Zustand store(slices: `session / player / npc / dialogue / ui`)
- `client/src/components/PlayerPanel.tsx`
- `client/src/api/sessionApi.ts`
- `Dockerfile` + `fly.toml`(后端 serve 前端 dist,单镜像)

**改写**(保持函数签名,内部换 SQLite,**调用方零改动**)
- `server/src/services/gameState.ts` L39-142 — `currentNpcStates` 模块级 `let` 改为 SQLite 查询;`getNpcProfile / getNpcState / applyStateDelta / executeIntent / resetNpcState / resetGameState` 签名不变;npc profiles 从 `server/src/data/npcs.json` 加载
- `server/src/services/memoryStore.ts` — 同样改为 SQLite,函数签名不变
- `server/src/services/promptBuilder.ts:3-5` — **修 bug**:`buildPrompt(npcId, scopedNpcId, playerInput, memories)`,内部用 `getNpcState(scopedNpcId)`;调用方 `server/src/routes/chat.ts:42` 同步更新
- `server/src/routes/chat.ts` — `validateChatRequest` 替换为 Zod schema;返回体加入 `player` 字段
- `server/src/index.ts` — 生产环境 `app.use(express.static('client/dist'))`
- `client/src/App.tsx` — 9 个 useState 迁到 Zustand store;`handleSend` 拆为 store action;`sessionId` 持久化到 localStorage
- `client/src/api/chatApi.ts` — 加 `AbortController` 超时(15s)+ 1 次重试
- `client/src/App.test.tsx:82` — 欢迎语对齐 `App.tsx:65`

### 新增依赖
- 后端:`better-sqlite3`、`zod`
- 前端:`zustand`、`react-router-dom`(只 wrap BrowserRouter,为阶段 3 预埋)

### 现有可复用
- `server/src/services/gameState.ts:81-96` `applyStateDelta` 的不可变更新模式 — 作为所有 store 写入的范式
- `server/src/services/responseValidator.ts:160-174` 的 clamp/截断逻辑 — 阶段 2 加入新 intent 时复用
- `client/src/styles/index.css` cyber-panel / cyber-corner 体系 — PlayerPanel 直接用 `cyber-panel--violet` 区分 NPC 面板
- `client/src/components/StatBar.tsx` — 玩家灵气池/血量直接复用

### 风险与决策
- **SQLite 持久化路径**:Fly.io 挂 1GB volume(免费档够),`DB_PATH=/data/game.db`。**不选 Render**:free 实例 SQLite 文件随重启清空
- **状态库选 Zustand 而非 Context+Reducer**:多 slice 时 Context 重渲染收敛差;Zustand 与 React 19 兼容
- **Repository 接口保持纯函数签名**:阶段 4 接入向量库时只改 `memoryStore.ts` 内部

### 验证
```bash
# 后端
cd server && npm test                    # Vitest 全绿
npm run dev                              # 启动
curl -X POST localhost:3001/api/session  # 返回 {sessionId, playerId}

# 前端
cd client && npm test                    # App.test.tsx 全绿
npm run dev                              # 三个标签页开三个 session 互不影响

# 持久化
# 1. 发几轮对话 → kill 后端进程 → 重启 → 刷新前端 → 对话历史 / NPC state 全部恢复

# 部署
fly deploy
# 拿到 URL,在第二台设备打开,创建 session 能用
```

**工作量**:M(~3-5 天)

---

## 阶段 2 — 修真数值系统(M)

**目标**:把"练气/灵根/灵石/丹药"从 flavor 落地成数值。玩家可以**打坐升灵气、买丹、炼丹、突破**,白璃 prompt 现在能拿到玩家真实数值。

### 最小可行数值模型
- **灵根**:5 系(金木水火土),每个 0-100;初始抽 2 主属(70/40)+ 3 杂属(0-20 随机);影响功法亲和与炼丹成品率
- **境界**:9 层练气 → 筑基初/中/后 → 金丹初/中/后,**共 15 阶**,本期开放到金丹初(够主线)
- **灵气池**:`qiCurrent / qiCap`;打坐 = 客户端定时器节流上报,后端按 elapsed 计算增量(防作弊用同样规则在服务端 recalculate);速率 = `baseRate * sum(rootScore * funaWeight)`
- **突破**:`qiCurrent >= qiCap && 心境 >= 阈值` 触发;成功率受 `tianDaoAlert` 影响(雷罚剧情接入点)
- **丹药**:`server/src/data/pills.json` 8-10 种丹药 → 效果(回灵气 / +突破成功率 / 短期屏蔽天道云)
- **炼丹**:纯规则,材料 + 火候(玩家选)+ 灵根加成 → 成败 + 品质,**不走 LLM**
- 所有平衡数值在 `server/src/data/balance.json`,代码不写死系数

### 可验证交付
- `POST /api/cultivate { duration }` / `POST /api/breakthrough` / `POST /api/alchemy/refine { recipeId, materials, fireLevel }`
- 玩家面板:灵根雷达图(`recharts`)+ 灵气进度条 + 境界标签 + 灵石计数
- 白璃 prompt `buildPlayerNarrative()` 改为动态读真实数值
- **第一个完整反馈环**:玩家威胁监察院 → tianDaoAlert 高 → 突破时雷罚失败 → 找白璃买屏蔽丹 → 服丹 tianDaoAlert 下降 → 安全突破

### 关键文件改动
**新建**
- `server/src/services/cultivationEngine.ts` — 打坐 / 突破纯规则
- `server/src/services/alchemyEngine.ts` — 炼丹纯规则
- `server/src/services/inventoryStore.ts` — 玩家物品 CRUD
- `server/src/data/{pills,techniques,roots,balance}.json`
- `server/src/routes/cultivation.ts` / `alchemy.ts`
- `client/src/components/CultivationPanel.tsx` / `AlchemyModal.tsx` / `InventoryPanel.tsx`
- `client/src/hooks/useCultivationTicker.ts` — 客户端节流上报

**改写**
- `server/src/types/player.ts` — 扩 `roots / inventory / techniques / cultivationStageIdx`
- `server/src/types/npc.ts:10-15` — `IntentType` 加 `complete_trade / teach_technique`
- `server/src/services/responseValidator.ts:126-147` — 新 intent 白名单复用现有 pattern
- `server/src/services/promptBuilder.ts:113-128` — `buildPlayerNarrative` 改读 store
- `server/src/services/llmClient.ts:31-103` — mock 分支按新 intent 扩
- `client/src/state/store.ts` — 加 `cultivation / inventory` slice

### 风险与决策
- **炼丹 mini-game 诱惑**:严格限制 ≤2 个用户输入(选配方 + 选火候)
- **客户端打坐计时器防作弊**:服务端必须用同样的 `cultivationEngine.calculate(playerState, elapsedMs)` recalculate,客户端报的 elapsed 只用来限频
- **平衡数值黑盒**:全挂 `balance.json`,后端启动时 require,不写死代码

### 验证
- 单测覆盖 `cultivationEngine` / `alchemyEngine` 所有边界(灵气溢出 / 失败概率 / 材料不足)
- E2E:打坐 30 秒 qi 增量符合公式;突破成功/失败两条路径都跑通
- 玩家面板雷达图渲染正确

**工作量**:M(~4-6 天)

---

## 阶段 3 — 多 NPC + 场景 + 任务系统(M→L)

**目标**:打破"只有白璃"。引入 3-4 个 NPC + 3-4 个场景,任务系统替代硬编码 quest_id。

### NPC 阵容(建议)
| NPC | 角色 | 派系 | 玩家关系起点 |
|---|---|---|---|
| 白璃 | 黑市炼丹师 | 无相黑市 | trust 20 |
| 苏鹤 | 假装掮客的监察院卧底 | 太清监察院(伪装) | trust 0,玩家不知道身份 |
| 赤目 | 雷罚帮派打手 | 雷罚帮 | trust -10,hostility 30 |
| 青姑 | 信息贩子(双面间谍) | 中立 | trust 10 |

### 场景(每个就是 NPC 集合 + 背景描述)
- 无相黑市(白璃) / 监察院外围(苏鹤) / 雷罚酒馆(赤目+青姑) / 玩家洞府(打坐用)

### 可验证交付
- 前端顶部场景切换器(react-router `/scene/:sceneId`)+ NPC 列表
- 点击 NPC 进对话,prompt 自动切换角色卡
- `quests` 表 + `npc_relations` 表(NPC 之间也有 trust/hostility)
- 任务状态机:`available → accepted → in_progress → completed/failed`
- 完成任务影响多个 NPC state(white-listed `quest_effect`)

### 关键文件改动
**新建**
- 表:`scenes / npc_scene / quests / quest_progress / npc_relations`
- `server/src/data/{npcs,scenes,quests}.json` — npc profiles 全部移出 `gameState.ts`
- `server/src/services/questEngine.ts`(`executeIntent` 重构入口)
- `server/src/services/sceneStore.ts`
- `server/src/services/mockResponders/{baili,suhe,chimu,qinggu}.ts` — `llmClient.ts:31-103` 的 mock 路由按 NPC 拆分
- `client/src/pages/{PlayPage,SettingsPage}.tsx`
- `client/src/components/{SceneSwitcher,NpcListPanel,QuestLog}.tsx`

**改写**
- `server/src/services/gameState.ts:5-18` — npcProfiles 改为从 JSON 加载;`executeIntent:99-117` 重写为查 `quests.json` 的 `intent → effect` 映射
- `server/src/services/promptBuilder.ts` — 第一次拆分:`buildSystemPrompt`(角色卡静态) + `buildUserTurn`(情境+输入),为阶段 5 prompt caching 铺路
- `client/src/App.tsx` — 拆 Pages,NPC id 不再硬编码(`App.tsx:129`)
- `client/src/api/chatApi.ts` — npcId 从 store 取

### 风险与决策
- **prompt token 暴涨**:每次只塞当前对话 NPC 的角色卡 + 在场 NPC 简介(name+role+一句关系)
- **场景设计陷阱**:**不做地图、不做格子、不做立绘 CG**。场景 = NPC 集合 + 背景描述 + 一张 placeholder 图

### 验证
- 4 个 NPC 各跑 3 轮对话,角色风格明显区分
- 一条跨 NPC 任务链:青姑透露苏鹤可能是卧底 → 玩家在白璃面前印证 → 苏鹤的 anger 上升
- 单测 questEngine 状态机所有转移

**工作量**:L(~6-8 天)

---

## 阶段 4 — 向量记忆 + 人格演化(M→L)

**目标**:记忆从"最近 20 条"升级到语义检索,跨 session 长期记得玩家关键行为;NPC 性格根据累计行为缓慢演化。

### 可验证交付
- 100+ 条历史下,NPC 在相关话题召回半月前的事件
- `GET /api/debug/memory/:npcId?q=...` 显示 top-5 检索结果 + 相似度
- 白璃 personality 数组动态多出一条(如玩家屡次救她 → 多"暧昧的迟疑"),反映在 prompt
- 玩家可见的"记忆水晶"页面,看到 NPC 记得自己的什么

### 关键文件改动
**新建**
- `server/src/services/embedding.ts` — OpenAI `text-embedding-3-small`;mock 模式用 hashing 降维(测试稳定)
- `server/src/services/personalityEvolution.ts` — 累计 `state_delta` + 重大事件触发 `evolved_traits` 变更
- `client/src/pages/MemoryCrystalPage.tsx`

**改写**
- `server/src/services/memoryStore.ts` — 接入 `sqlite-vec` 扩展(`embedding BLOB` 列已在阶段 1 schema 预留);保留最近 N 条 buffer + top-k 检索混合
- `server/src/services/promptBuilder.ts` — `memoryText` 改为 `retrieveRelevant(query, scopedNpcId, k=5) + recentBuffer(k=3)` 合并

### 新增依赖
- `sqlite-vec`(SQLite 原生向量扩展)。**备选** `hnswlib-node`(纯内存,启动时从 SQLite reload),数据 < 10k 性能完全够,Windows 装扩展折腾时切到这个

### 风险与决策
- **embedding token 成本**:只对 memory 条目(≤60 字)和 query(≤80 字)embed,**对话本身绝不存向量**
- **personality evolution 不可逆**:加 "revert" 调试接口

**工作量**:L(~5-7 天)

---

## 阶段 5 — 群聊 + NPC 间对话 + Prompt 优化(L)

**目标**:同场景多 NPC 时玩家一句话触发**多 NPC 接力**;NPC 之间不依赖玩家自发对话(后台事件)。

### 可验证交付
- 雷罚酒馆同时有赤目和青姑时,玩家挑衅赤目,青姑可能插话(规则:`anger > 70 && relations[B→A] > 30`)
- 玩家离场后,后台 `setInterval` 每 30 分钟跑 NPC 间事件,**只在玩家不在场时跑,每天总量上限**
- prompt 改为分层 message,Anthropic prompt caching 启用,token 成本降 40%+

### 关键文件改动
**新建**
- `server/src/services/groupChatOrchestrator.ts` — 决定哪些 NPC 发言、顺序、是否插话
- `server/src/services/backgroundEvents.ts` — 离线事件生成器 + `sceneLock`

**改写**
- `server/src/services/llmClient.ts` — 拆 `requestLlm(messages[])`(底层)+ 当前函数迁到 wrapper
- `server/src/services/promptBuilder.ts` — `buildSystemPrompt` 加 `cache_control` 标记(Claude)
- `client/src/components/DialoguePanel.tsx` — 多 NPC 头像 + 气泡颜色区分

### 风险与决策
- **群聊变排队复读**:每轮最多 2 NPC 接话 + 发言冷却 + 旁观者用 Haiku/mini 模型省钱
- **后台事件冲突玩家在场**:`sceneLock` 玩家进场景立即 abort

**工作量**:L(~6-8 天)

---

## 阶段 6 — 主线剧情 + 法宝 + 多结局(M)

**目标**:把现有"主线雏形"做成可结束剧情线 + 存档分支,让 demo 有"打通关"体验。

### 可验证交付
- 主线:玩家从无相黑市 → 摸清苏鹤是卧底 → 揭发 or 合作 → 触发 3 结局(雷罚 / 突破金丹 / 逃出九龙)
- 法宝(3 件):每件 1 个被动 + 1 个对话 trigger(如"焚天令"装备后白璃台词变软)
- 存档分支:任意 session 可"复制为新存档"试不同选择
- 结局画面 + 分享卡片(Canvas → png)

### 关键文件改动
- `server/src/data/storyline.json` + `server/src/services/storyEngine.ts`(剧情节点状态机)
- `server/src/services/artifactEngine.ts` + `server/src/data/artifacts.json`
- 表:`save_branches / story_progress`
- 前端 `pages/EndingPage.tsx` / `components/ArtifactPanel.tsx`
- `html2canvas` 或 `satori` 生成分享卡片

**工作量**:M(~4-6 天)

---

## 阶段 7 — 测试加固 + 可观测性(S→M)

**目标**:补技术债 + 加可观测性,demo 真正稳定。

### 可验证交付
- LLM 超时 / 500 / 并发 / 限流测试齐全
- `/api/debug/metrics`:每 NPC token 消耗 / 平均响应时间 / mock 命中率
- Playwright E2E:核心 3 条路径(注册 session / 完成一次交易 / 突破一次)
- 前端错误收集(Sentry 或 console aggregator)

### 关键文件改动
- `server/src/__tests__/{llmClient.timeout,chatRoute.concurrent}.test.ts`
- `server/src/services/observability.ts` — in-memory metrics
- `e2e/playwright.config.ts` + `e2e/specs/`
- `client/src/api/chatApi.ts` — 加 `p-retry`(可选)

**工作量**:S→M(~2-4 天)

---

## 关键决策速查

| 决策 | 选择 | 理由 |
|---|---|---|
| SQLite 驱动 | `better-sqlite3` | 同步 API + 单文件 + Fly volume 友好;不选 Prisma 因冷启动慢且 schema 演化重 |
| 向量库 | `sqlite-vec` 扩展,备选 `hnswlib-node` 内存索引 | 不引入额外进程,部署单二进制 |
| 前端状态 | Zustand | 多 slice 重渲染收敛优于 Context |
| 路由 | react-router-dom | 阶段 1 预埋,避免阶段 3 重构 |
| 校验 | Zod | schema 即类型,接替手写 `validateChatRequest` |
| 部署 | Fly.io | SQLite 持久化 + 单进程 + 免费档够 demo;Vercel 后端不适合 SQLite |
| LLM 分工 | 对话/叙事走 LLM,数值/任务/修炼/炼丹走规则 | 控 token 成本、保数值可预测 |
| Prompt 优化 | 阶段 5 拆 system/user + Anthropic caching | 多 NPC 时 token 主要花在角色卡 |

---

## 留给用户审阅的决策点

> 如果你对下面任一点有不同想法,在 plan 通过前直接告诉我,我修正后再开工。

**决策点 A — 阶段顺序是否调整?**
当前是"先深后广"(基础设施 → 数值 → 多 NPC → 向量记忆 → 群聊 → 剧情 → 部署)。如果你想先看到"世界感",可对调 2 和 3:**阶段 2 做多 NPC + 场景,阶段 3 做修真数值**。代价是修真数值要更晚才看到完整反馈环。

**决策点 B — 第一阶段是否就部署?**
当前设计阶段 1 末就部署到 Fly.io 拿可分享 URL,这样可以边迭代边给朋友演示。如果你想"系统稳了再放出去",可以把部署延到阶段 7。

**决策点 C — 世界观调性**
继续保持"赛博朋克 + 修真"混搭(义体 / 天道云 / 九龙下城),还是后期引入传统修仙派别(峨眉/昆仑等)冲淡赛博感?**默认继续保持混搭**——这是当前 demo 的差异化卖点。

**决策点 D — 修真境界开放到哪一阶?**
默认 demo 期开放到金丹初(15 阶里的第 13 阶,够主线"逃出九龙"),元婴及以上留给续作。如果你想一口气开到化神/合体,数值平衡和剧情都要扩。

**决策点 E — 玩家能扮演谁?**
默认锁定"陆玄"(右臂义体、雷罚残痕、非法灵根)— 与现有 prompt 与白璃台词风格匹配。如果你想做"玩家自定义角色卡"(选名字 / 灵根 / 背景),需要在阶段 1 加角色创建页,工作量 +1 天。

---

## Critical Files for Implementation

阶段 1 优先修改(项目根相对路径):
- `server/src/services/gameState.ts` — Repository 内部换 SQLite,签名不变
- `server/src/services/memoryStore.ts` — 同上,预留 embedding 列
- `server/src/services/promptBuilder.ts:3-5` — 修 scopedNpcId bug
- `server/src/routes/chat.ts` — 加 Zod;新建 `server/src/routes/session.ts`
- `server/src/types/npc.ts` — 拆 `PlayerProfile` + `PlayerState`
- `client/src/App.tsx` — 9 个 useState 迁 Zustand
- `client/src/api/chatApi.ts` — 加超时/重试
- `client/src/App.test.tsx:82` — 修文案

阶段 2 优先修改:
- `server/src/types/npc.ts` — IntentType 扩 `complete_trade / teach_technique`
- `server/src/services/responseValidator.ts:126-147` — 新 intent 白名单
- `server/src/services/promptBuilder.ts:113-128` — buildPlayerNarrative 动态读

---

## 总体验证(每阶段都要过)

- `cd server && npm test` 全绿
- `cd client && npm test` 全绿
- 手测:多 session 隔离、对话流畅、状态持久化、刷新不丢档
- 部署后线上 URL 可访问、性能 ≤ 现状
- 当前阶段所有 "可验证交付" 项逐一手测通过

---

## 跨机器/跨 agent 接力指引

如果你在另一台机器(或换了 agent)继续这个项目:

1. **快速重建上下文**:先读 `README.md` → 本文件 → `server/src/services/gameState.ts` + `promptBuilder.ts` + `client/src/App.tsx`
2. **找当前进度**:看 git log / 阶段号 commit message;每阶段建议起一个 branch `phase-N-xxx`
3. **决策点状态**:如果用户已经选定了某个决策点,把结果记录到本文件顶部(在 Context 段下加 "## 已确认决策" 小节)
4. **不要跳过阶段**:每阶段都依赖前面阶段的基础设施(尤其阶段 1 的 SQLite + Zustand 是后面所有阶段的地基)
