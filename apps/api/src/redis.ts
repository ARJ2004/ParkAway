import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  // Fail fast rather than buffering commands indefinitely when Redis is down —
  // rate limiting and the session-version cache both need to know promptly
  // that Redis is unavailable so they can fail closed/safe (see rateLimit.ts
  // and modules/auth/session.service.ts).
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on("error", (err) => {
  console.error("Redis client error:", err.message);
});
