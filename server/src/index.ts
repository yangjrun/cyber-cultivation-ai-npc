import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRateLimit } from "./middleware/rateLimit.js";
import { chatRouter } from "./routes/chat.js";
import { sessionRouter } from "./routes/session.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "16kb" }));
  app.use("/api/session", createRateLimit({ windowMs: 60_000, maxRequests: 30, message: "会话创建过于频繁，请稍后再试。" }), sessionRouter);
  app.use("/api/chat", createRateLimit({ windowMs: 60_000, maxRequests: 120, message: "请求过于频繁，请稍后再试。" }), chatRouter);

  if (process.env.NODE_ENV === "production") {
    const clientDist = path.join(getRepoRoot(), "client", "dist");
    app.use(express.static(clientDist));
    app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  process.stderr.write(`API error: ${message}\n`);
  res.status(500).json({ error: "服务器暂时无法回应，请稍后再试。" });
};

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3001);
  const app = createApp();

  app.listen(port, () => {
    process.stdout.write(`AI NPC server listening on http://localhost:${port}\n`);
  });
}

function getRepoRoot(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const serverRoot = path.resolve(currentDir, "..");
  return path.resolve(serverRoot, "..");
}
