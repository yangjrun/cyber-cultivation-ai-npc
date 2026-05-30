# 九龙下城 · 以仙途 AI NPC 对话 Demo

一个赛博修真题材的 AI NPC 对话与轻量 RPG 系统 Demo，用于验证“NPC 活起来”的端到端体验。

当前舞台以九龙下城为核心，包含无相黑市、白璃丹铺等场景；玩家以带有非法灵根烙印的散修身份进入下城，与炼丹师、掮客、妖修等 NPC 对话、交易、修炼、炼丹、推进任务，并在史册中记录关键事件。

## 功能概览

- 多 NPC 场景对话：后端仲裁发言顺序，支持插话、沉默、动作描写与多 NPC 回复。
- 三种输入模式：`dialogue` 普通对话、`action` 动作尝试、`monologue` 内心独白。
- AI 回复结构化校验：模型输出会经过 JSON 修复、intent 校验、状态边界钳制和世界观违规扫描。
- 会话与存档：浏览器只保存 `sessionId`，后端用 SQLite 恢复玩家、NPC、背包、任务、记忆和世界状态。
- 记忆系统：每个会话/NPC 维护近期记忆，并支持向量检索；默认本地 hash embedding，可切换 OpenAI-compatible embedding。
- RPG 子系统：修炼、突破、炼丹、背包、任务、法宝、人格演化、编年史和 debug metrics。
- Mock LLM 模式：未配置 `LLM_API_KEY` 时自动使用 deterministic mock responder，方便本地开发和 E2E。

## 技术栈

- 前端：React 19 + TypeScript + Vite + React Router + Zustand + Tailwind CSS
- 后端：Node.js + Express + TypeScript + Zod + better-sqlite3
- AI 接入：OpenAI-compatible Chat Completions，或 `LLM_API_FORMAT=claude` 的 Anthropic Messages API
- 测试：Vitest + Supertest + React Testing Library + Playwright
- 存储：SQLite；默认 `server/data/game.db`，测试环境 `:memory:`，可用 `DB_PATH` 覆盖

## 快速开始

```bash
npm install
npm run install:all
npm run dev
```

默认地址：

- 前端：<http://localhost:5173>
- 后端：<http://localhost:3001>
- 开发代理：前端通过 Vite proxy 将 `/api` 转发到 `http://localhost:3001`

也可以使用后台开发启动器：

```bash
npm run dev:start
npm run dev:status
npm run dev:logs
npm run dev:stop
```

`dev:start` 会把 pid 和日志写入 `.dev/`，并通过端口识别/停止进程。

## 常用命令

```bash
# 安装子项目依赖
npm run install:all

# 同时运行后端和前端
npm run dev

# 后台运行/停止本地开发服务
npm run dev:start
npm run dev:stop
npm run dev:restart
npm run dev:status
npm run dev:logs
npm run dev:logs -- server
npm run dev:logs -- client

# 质量检查
npm run lint
npm run typecheck
npm run test
npm run build

# E2E
npm run e2e:install
npm run e2e
npm run e2e:ui
```

分别运行子项目：

```bash
npm run dev --prefix server
npm run dev --prefix client
npm run test --prefix server
npm run test --prefix client
npm run build --prefix server
npm run build --prefix client
```

运行单个测试：

```bash
# 后端单文件或按名称
npm run test --prefix server -- src/__tests__/chatRoute.test.ts
npm run test --prefix server -- -t "测试名片段"

# 前端单文件或按名称
npm run test --prefix client -- src/App.test.tsx
npm run test --prefix client -- -t "测试名片段"

# E2E 单文件或按标题
npm run e2e -- e2e/specs/session.spec.ts
npm run e2e -- -g "测试标题片段"
```

## 环境变量

复制 `server/.env.example` 到 `server/.env`，按需填写：

```bash
LLM_API_KEY=
LLM_API_FORMAT=openai
LLM_BASE_URL=https://your-relay.example.com/v1
LLM_MODEL=gpt-4o-mini
PORT=3001
```

常用配置：

- `LLM_API_KEY`：为空时启用 mock 模式。
- `LLM_API_FORMAT`：`openai` 或 `claude`。
- `LLM_BASE_URL` / `LLM_MODEL`：模型服务地址与模型名。
- `LLM_TIMEOUT_MS` / `LLM_MAX_RETRIES`：LLM 请求超时与重试。
- `DB_PATH`：覆盖 SQLite 存档路径。
- `EMBEDDING_PROVIDER`：默认 `hash`；可设为 `openai` 使用 `/embeddings` endpoint。
- `ENABLE_DEBUG_API=true`：在生产环境显式开启 `/api/debug`。

## 项目结构

```text
client/                 React/Vite 前端
  src/api/              前端 API 边界，统一走相对 /api
  src/pages/            页面级组件：创角、对话、记忆水晶、史册、设置
  src/components/       面板与展示组件
  src/state/            Zustand store、slices、selectors、types
server/                 Express/TypeScript 后端
  src/routes/           HTTP 路由与请求校验入口
  src/services/         对话编排、LLM、记忆、任务、修炼、炼丹、法宝等业务逻辑
  src/data/             NPC、场景、物品、任务、平衡参数与世界配置
  src/db/               SQLite 连接与 migrations
  src/schemas/          Zod 请求体验证
  src/types/            领域类型
  data/                 默认 SQLite 存档目录
e2e/specs/              Playwright 端到端测试
docs/                   规划与世界观文档
scripts/dev.mjs         跨平台后台开发启动器
```

高层数据流：

1. 前端在 `localStorage` 中维护 `lower-city.sessionId`，首次访问无存档时进入 `/create`。
2. `POST /api/session` 创建会话；`GET /api/session/:id` 恢复玩家、NPC 状态、任务、记忆、背包与当前场景。
3. 对话页从 Zustand 单 store 读取状态；不同业务切片负责 session、chat、scene、cultivation、alchemy、artifact、chronicle 和日志。
4. 前端 `POST /api/chat` 发送 `{ sessionId, npcId, playerInput, inputMode }`。
5. 后端按 input mode 进入群聊编排、动作解析或心声旁白；dialogue 模式会调用 turn arbiter、prompt builder、LLM/mock、response validator、世界观校验、状态/任务/记忆更新。
6. 后端返回 `replies`；前端优先按多 NPC replies 归并消息和状态，顶层 `dialogue`/`intent`/`state` 仅兼容第一条回复。

## API 概览

主要路由挂载在 `server/src/index.ts`：

- `POST /api/session`：创建玩家会话，可传角色名、五行灵根与特质。
- `GET /api/session/traits`：列出可选玩家特质。
- `GET /api/session/:id`：恢复会话快照。
- `POST /api/chat`：推进一次对话/动作/心声回合。
- `POST /api/chat/reset`：重置指定 NPC 对话状态和记忆。
- `/api/scenes`、`/api/quests`、`/api/memory`、`/api/personality`：场景、任务、记忆和人格相关接口。
- `/api/cultivate`、`/api/breakthrough`、`/api/alchemy`、`/api/inventory`、`/api/artifacts`：RPG 子系统接口。
- `/api/chronicle`：编年史接口。
- `/api/debug`：开发环境默认启用；生产环境默认关闭，除非设置 `ENABLE_DEBUG_API=true`。

示例：`POST /api/chat`

请求体：

```json
{
  "sessionId": "00000000-0000-0000-0000-000000000000",
  "npcId": "baili",
  "playerInput": "我需要躲过监察院望气的丹药",
  "inputMode": "dialogue"
}
```

响应会包含兼容字段和多 NPC replies：

```json
{
  "dialogue": "能做，但你得先拿到监察密钥。",
  "tone": "试探",
  "intent": { "type": "give_quest", "params": { "quest_id": "steal_inspector_key" } },
  "state": { "trust": 21, "fear": 11, "anger": 0, "tianDaoAlert": 45 },
  "memoryAdded": "玩家想要躲避监察院望气的丹药。",
  "actionResult": "任务已触发：偷取监察密钥。",
  "mode": "dialogue",
  "replies": []
}
```

## 测试说明

- 后端测试位于 `server/src/__tests__`，使用 Vitest + Supertest；测试环境 SQLite 为内存库。
- 前端测试与源码 colocated，使用 Vitest + jsdom + React Testing Library，setup 在 `client/src/test/setup.ts`。
- Playwright E2E 位于 `e2e/specs`；运行时会启动 `npm run dev`，baseURL 为 `http://localhost:5173`。
- E2E 配置会强制 `LLM_API_KEY=""`，确保使用 mock LLM，避免本地真实 key 影响确定性。

## 生产运行

```bash
npm run build
```

PowerShell：

```powershell
$env:NODE_ENV = "production"
npm run start --prefix server
```

Bash：

```bash
NODE_ENV=production npm run start --prefix server
```

生产模式下后端会托管 `client/dist`，并对非 `/api` 路径 fallback 到 SPA 的 `index.html`。
