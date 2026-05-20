import type { RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
  message: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

export function createRateLimit({ windowMs, maxRequests, message }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      res.status(429).json({ error: message });
      return;
    }

    buckets.set(key, { ...current, count: current.count + 1 });
    next();
  };
}
