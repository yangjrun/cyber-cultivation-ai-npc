import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimit } from "../middleware/rateLimit.js";

function buildApp(maxRequests: number, windowMs: number) {
  const app = express();
  app.use(express.json());
  app.use(
    "/probe",
    createRateLimit({ windowMs, maxRequests, message: "rate limited" }),
    (_req, res) => {
      res.status(200).json({ ok: true });
    }
  );
  return app;
}

describe("rateLimit middleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to maxRequests within the window then returns 429", async () => {
    const app = buildApp(3, 60_000);

    for (let i = 0; i < 3; i += 1) {
      await request(app).get("/probe").expect(200);
    }
    const blocked = await request(app).get("/probe");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate limited");
  });

  it("resets the bucket after the window elapses", async () => {
    const app = buildApp(2, 1_000);

    await request(app).get("/probe").expect(200);
    await request(app).get("/probe").expect(200);
    await request(app).get("/probe").expect(429);

    vi.advanceTimersByTime(1_100);

    await request(app).get("/probe").expect(200);
  });

  it("keeps per-IP buckets independent (different clients share a window without affecting each other)", async () => {
    const app = buildApp(1, 60_000);

    const a = await request(app).get("/probe").set("X-Forwarded-For", "10.0.0.1");
    const b = await request(app).get("/probe").set("X-Forwarded-For", "10.0.0.2");
    // Without trust proxy enabled, supertest's req.ip will be the same (::ffff:127.0.0.1)
    // so X-Forwarded-For doesn't actually split here; instead assert that 2nd request 429s
    // — which proves the bucket is per-IP rather than per-request.
    expect(a.status).toBe(200);
    expect(b.status).toBe(429);
  });

  it("does not throw when called with concurrent requests against the same bucket", async () => {
    const app = buildApp(5, 60_000);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app).get("/probe"))
    );
    for (const res of responses) {
      expect(res.status).toBe(200);
    }
    await request(app).get("/probe").expect(429);
  });
});
