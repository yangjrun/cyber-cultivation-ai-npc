# 赛博修仙 AI NPC 对话 Demo

一个最小可用的 AI NPC 对话 Demo，用于验证“NPC 活起来”的效果。

场景：九龙下城 / 无相黑市 / 白璃丹铺。

NPC：白璃，黑市炼丹师。

玩家：陆玄，非法灵根持有者。

## 功能列表

- 玩家输入文字与 NPC 对话。
- 后端调用 LLM API 生成 NPC 回复。
- 未配置 `LLM_API_KEY` 时自动使用 mock 模式。
- NPC 回复必须是结构化 JSON。
- 后端校验 AI 输出，处理非法 JSON、非法 intent、超长文本和越界状态。
- NPC 回复普通台词限制在 40 个中文字符以内。
- NPC 状态包含 `trust`、`fear`、`anger`、`tianDaoAlert`。
- 内存记忆保存最近信息，每个 NPC 最多 20 条。
- NPC intent 支持交易、给任务、拒绝服务、举报玩家等行为。
- 前端展示对话历史、NPC 状态、最近记忆和动作结果。

## 技术栈

- 前端：React + TypeScript + Vite + Tailwind CSS
- 后端：Node.js + Express + TypeScript
- 测试：Vitest + Supertest + React Testing Library
- 存储：第一版使用内存对象

## 运行方式

### 一次性安装并启动

```bash
npm install
npm run install:all
npm run dev
```

前端默认运行在 Vite 端口，后端默认运行在 `http://localhost:3001`。

### 分别运行

后端：

```bash
cd server
npm install
npm run dev
```

前端：

```bash
cd client
npm install
npm run dev
```

## 环境变量

复制 `.env.example` 到 `server/.env`，按需填写：

```bash
LLM_API_KEY=你的key
LLM_BASE_URL=模型接口base url
LLM_MODEL=模型名称
PORT=3001
```

## Mock 模式

如果没有配置 `LLM_API_KEY`，后端会自动进入 mock 模式，保证项目可以直接运行。

mock 会根据玩家输入返回预设回复：

- 包含“丹药”或“扫描”：触发任务 `steal_inspector_key`。
- 包含“买”：触发交易 intent。
- 包含“威胁”、“杀”、“抢”：拒绝服务并提升 anger。
- 其他输入：返回默认不耐烦回复。

## 真实 LLM API 接入

配置 `server/.env` 后，后端会向 OpenAI-compatible Chat Completions 接口发起请求：

```text
POST {LLM_BASE_URL}/chat/completions
```

请求使用：

- `Authorization: Bearer ${LLM_API_KEY}`
- `model: LLM_MODEL`
- prompt 由 `server/src/services/promptBuilder.ts` 构建

真实模型返回仍会经过 `responseValidator` 校验，只有标准化结果会进入游戏系统。

## 安全说明

- 不要把 API Key 放在前端代码中。
- 前端不得直接调用 LLM。
- AI 输出必须由后端校验。
- AI 只能返回台词、语气、intent、状态变化建议和记忆文本。
- AI 不能直接改存档，真实状态只由 `gameState` 执行。
- 非法 intent 会被改为 `none`。
- `give_quest` 只能触发 `quest_id=steal_inspector_key`。
- 状态值始终限制在 `0..100`。

## 测试与构建

```bash
npm run test
npm run typecheck
npm run build
```

也可以分别运行：

```bash
npm run test --prefix server
npm run test --prefix client
npm run typecheck --prefix server
npm run typecheck --prefix client
npm run build --prefix server
npm run build --prefix client
```

## API

### POST `/api/chat`

请求：

```json
{
  "playerInput": "我需要躲过监察院扫描的丹药",
  "npcId": "baili"
}
```

响应：

```json
{
  "dialogue": "能做，但你得先偷一枚监察密钥。",
  "tone": "试探",
  "intent": {
    "type": "give_quest",
    "params": {
      "quest_id": "steal_inspector_key"
    }
  },
  "state": {
    "trust": 21,
    "fear": 11,
    "anger": 0,
    "tianDaoAlert": 45
  },
  "memoryAdded": "玩家想要躲避监察院扫描的丹药。",
  "actionResult": "任务已触发：偷取监察密钥。"
}
```

## 后续扩展建议

- 增加更多 NPC。
- 增加 SQLite 持久化。
- 增加向量记忆。
- 增加任务系统。
- 增加 Unity/Godot 客户端。
