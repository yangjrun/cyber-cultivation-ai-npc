# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

Install dependencies:

```bash
npm install
npm run install:all
npm run e2e:install
```

Run the app:

```bash
# Foreground: server + client via concurrently
npm run dev

# Background local launcher; writes .dev/*.pid and .dev/*.log
npm run dev:start
npm run dev:status
npm run dev:logs
npm run dev:logs -- server
npm run dev:logs -- client
npm run dev:stop
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Vite proxies `/api` to `http://localhost:3001`

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

Run checks by package:

```bash
npm run lint --prefix server
npm run typecheck --prefix server
npm run test --prefix server
npm run build --prefix server

npm run lint --prefix client
npm run typecheck --prefix client
npm run test --prefix client
npm run build --prefix client
```

Run a single test:

```bash
# Backend Vitest
npm run test --prefix server -- src/__tests__/chatRoute.test.ts
npm run test --prefix server -- -t "test name fragment"

# Frontend Vitest
npm run test --prefix client -- src/App.test.tsx
npm run test --prefix client -- -t "test name fragment"

# Playwright E2E
npm run e2e -- e2e/specs/session.spec.ts
npm run e2e -- -g "test title fragment"
```

Production run:

```bash
npm run build
```

PowerShell:

```powershell
$env:NODE_ENV = "production"
npm run start --prefix server
```

Bash:

```bash
NODE_ENV=production npm run start --prefix server
```

In production mode the Express server serves `client/dist` and falls back non-`/api` routes to the SPA.

## High-level architecture

This is a TypeScript monorepo with root scripts that orchestrate two packages:

- `client/`: React 19 + Vite frontend using React Router, Zustand and Tailwind CSS.
- `server/`: Express backend using Zod validation and better-sqlite3 persistence.
- `e2e/specs/`: Playwright tests.
- `docs/`: planning and worldview documents.

The current implementation is not memory-only. Persistent game state lives in SQLite:

- Default DB: `server/data/game.db`
- Test DB: `:memory:`
- Override with `DB_PATH`
- `server/src/db/connection.ts` enables foreign keys, WAL and migrations automatically.

## Frontend structure

Important frontend paths:

- `client/src/App.tsx`: route tree and top navigation.
- `client/src/pages/`: page-level flows: character creation, play, memory crystal, chronicle and settings.
- `client/src/components/`: reusable panels and display components.
- `client/src/api/`: frontend API boundary; requests use relative `/api/*` URLs.
- `client/src/state/`: one Zustand store composed from slices.

Session behavior:

- Browser storage only keeps the session id under `lower-city.sessionId`.
- `cyber-cultivation.sessionId` is a legacy key migrated by `client/src/state/utils.ts`.
- `/` redirects to `/create` if no session exists; otherwise to `/play`.
- `/play` can also be addressed as `/play/scene/:sceneId`.

Zustand state is composed in `client/src/state/store.ts` from slices for session, chat, scene, cultivation, alchemy, artifacts, chronicle and logs. `messagesByNpc` and `memoriesByNpc` are keyed by base NPC id on the client; the server stores NPC-specific data with scoped ids in the form `sessionId::npcId`.

The client should prefer `response.replies` when handling chat responses. Top-level `dialogue`, `intent`, `state`, `memoryAdded` and `actionResult` are compatibility fields for the first reply.

## Backend structure

Important backend paths:

- `server/src/index.ts`: Express app creation, route mounting, rate limits, debug route gating and production static hosting.
- `server/src/routes/`: HTTP route layer; validates request shape and delegates to services.
- `server/src/schemas/`: Zod-based request validation.
- `server/src/services/`: domain logic for group chat, LLM calls, validation, memory, quests, scenes, cultivation, alchemy, artifacts and chronicle.
- `server/src/data/`: static world data: NPCs, scenes, items, quests, player traits and balance values.
- `server/src/types/`: shared domain types.
- `server/src/db/`: SQLite connection and migrations.
- `server/src/middleware/rateLimit.ts`: in-memory API rate limiting.

Route groups mounted by `server/src/index.ts`:

- `/api/session`
- `/api/chat`
- `/api/cultivate`
- `/api/breakthrough`
- `/api/alchemy`
- `/api/inventory`
- `/api/scenes`
- `/api/quests`
- `/api/memory`
- `/api/personality`
- `/api/chronicle`
- `/api/artifacts`
- `/api/debug` when enabled

`/api/debug` is enabled outside production. In production it is disabled unless `ENABLE_DEBUG_API=true`.

## Chat and game-state data flow

A normal chat turn flows through these layers:

1. Frontend `chatSlice` appends the player message and sends `POST /api/chat` with `{ sessionId, npcId, playerInput, inputMode }`.
2. `server/src/routes/chat.ts` validates the request, checks session/NPC existence, loads player and active scene context.
3. `inputMode` selects one of three flows:
   - `dialogue`: group chat orchestration.
   - `action`: narrator action resolution.
   - `monologue`: inner-monologue echo.
4. Dialogue mode uses `groupChatOrchestrator`, `turnArbiter`, `npcTurnProcessor`, `promptBuilder`, `llmClient`, `responseValidator` and `worldviewValidator`.
5. Services apply state deltas, quest progress, personality changes, world flags and memory writes.
6. The response includes `replies`; the frontend expands them into displayed messages and merges player/NPC state updates.

Narrator replies use `npcId: "narrator"`. Action and monologue turns may include `affectedStates` for multiple NPCs rather than a normal single-NPC reply.

## LLM and embedding behavior

LLM configuration lives in `server/.env` copied from `server/.env.example`.

- If `LLM_API_KEY` is empty or missing, the backend uses deterministic mock responders.
- Default API format is OpenAI-compatible `/chat/completions`.
- Set `LLM_API_FORMAT=claude` to use Anthropic Messages API format.
- `llmClient` includes timeout/retry handling and observability metrics.
- Claude-format calls attach ephemeral cache control to the system prompt portion.
- Embeddings default to local hash embeddings. Set `EMBEDDING_PROVIDER=openai` to use an OpenAI-compatible `/embeddings` endpoint.

Playwright sets `LLM_API_KEY=""` in `playwright.config.ts`, forcing mock mode even if a real key exists in `server/.env`.

## Testing layout

- Backend tests: `server/src/__tests__/*.test.ts`, using Vitest and Supertest in Node environment.
- Frontend tests: colocated `*.test.ts` / `*.test.tsx`, using Vitest, jsdom and React Testing Library. Setup file: `client/src/test/setup.ts`.
- E2E tests: `e2e/specs/*.spec.ts`, using Playwright with Chromium, `workers: 1`, trace retained on failure, and screenshots only on failure.

Playwright's `webServer` starts `npm run dev` at base URL `http://localhost:5173` and reuses an existing local server outside CI.

## Project-specific notes

- Request bodies are intentionally small; Express JSON limit is `16kb`.
- Chat input is validated at 1-80 characters in `server/src/schemas/chat.ts`; frontend constant `MAX_INPUT` is also 80.
- Known base NPC ids currently include `baili`, `suhe`, `chimu` and `qinggu` in `client/src/state/constants.ts`.
- The default client NPC is `baili`; the default scene is `black_market`.
- API fetches on the frontend use `fetchJsonWithRetry` with a 15s timeout, two retries, and retry only for network errors, 429, and 5xx HTTP errors.
- `POST /api/chat/reset` clears the scoped NPC state, memories and personality for that session/NPC.
