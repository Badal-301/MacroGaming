import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { config } from "../config/index.js";

// Global Redis client or in-memory fallback
let redisClient: Redis | null = null;
const memoryRateLimits = new Map<string, { count: number; expiresAt: number }>();

try {
  if (process.env.NODE_ENV !== "test") {
    redisClient = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't hang on connection failure
    });
    redisClient.connect().catch(() => {
      console.warn("Redis connection failed. Using in-memory rate limiting fallback.");
      redisClient = null;
    });
  }
} catch {
  redisClient = null;
}

export function clearRateLimits() {
  memoryRateLimits.clear();
}

/**
 * Increment rate limit counter with a TTL window
 */
async function incrementCounter(key: string, windowSeconds: number): Promise<number> {
  if (redisClient && redisClient.status === "ready") {
    try {
      const count = await redisClient.incr(key);
      if (count === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      return count;
    } catch {
      // Fallback to memory
    }
  }

  const now = Date.now();
  const entry = memoryRateLimits.get(key);

  if (!entry || now > entry.expiresAt) {
    memoryRateLimits.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return 1;
  }

  entry.count += 1;
  return entry.count;
}

/**
 * Get current counter value without incrementing
 */
async function getCounter(key: string): Promise<number> {
  if (redisClient && redisClient.status === "ready") {
    try {
      const val = await redisClient.get(key);
      return val ? parseInt(val, 10) : 0;
    } catch {
      // Fallback
    }
  }

  const now = Date.now();
  const entry = memoryRateLimits.get(key);
  if (!entry || now > entry.expiresAt) {
    return 0;
  }
  return entry.count;
}

/**
 * Login Rate Limiter Middleware
 * Refuses 6th attempt within a 60-second window per IP and email (FR13 / TC10).
 */
export async function loginRateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  const email = (req.body?.email || "anonymous").toLowerCase();
  const key = `ratelimit:login:${ip}:${email}`;

  const attempts = await getCounter(key);

  if (attempts >= 5) {
    res.status(429).json({
      error: "Too many login attempts. Please try again after 60 seconds.",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: 60,
    });
    return;
  }

  // Hook into response to increment on authentication failure
  res.on("finish", async () => {
    if (res.statusCode === 401) {
      await incrementCounter(key, 60);
    }
  });

  next();
}

/**
 * General Endpoint Rate Limiter (Deposits, Withdrawals, Bets)
 */
export function createRateLimiter(limit: number = 20, windowSeconds: number = 60, keyPrefix: string = "general") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const userId = req.user?.userId || "anon";
    const key = `ratelimit:${keyPrefix}:${ip}:${userId}`;

    const count = await incrementCounter(key, windowSeconds);

    if (count > limit) {
      res.status(429).json({
        error: `Rate limit exceeded. Maximum ${limit} requests per ${windowSeconds}s.`,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: windowSeconds,
      });
      return;
    }

    next();
  };
}

