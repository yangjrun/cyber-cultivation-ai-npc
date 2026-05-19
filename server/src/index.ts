import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import { chatRouter } from "./routes/chat.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "16kb" }));
  app.use("/api/chat", chatRouter);
  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "Unknown server error";
  console.error("API error", { message });
  res.status(500).json({ error: "服务器暂时无法回应，请稍后再试。" });
};

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3001);
  const app = createApp();

  app.listen(port, () => {
    console.log(`AI NPC server listening on http://localhost:${port}`);
  });
}
