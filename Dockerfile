FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN npm ci \
  && npm ci --prefix server \
  && npm ci --prefix client

COPY . .

RUN npm run build \
  && npm prune --omit=dev --prefix server

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/game.db

COPY --from=build /app/server/package*.json ./server/
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

WORKDIR /app/server

EXPOSE 3001

CMD ["node", "dist/index.js"]
