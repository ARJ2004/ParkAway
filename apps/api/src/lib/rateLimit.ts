import { redis } from "../redis.js";
import { ServiceUnavailableError } from "./errors.js";

/**
 * Fixed-window Redis counter. Fails CLOSED (rejects the request) if Redis is
 * unreachable — never fails open. See docs/planning/04-sprint-1-detailed-plan.md,
 * concurrency/idempotency plan: an OTP-request or admin-login rate limiter that
 * fails open during a Redis outage means unlimited unrated SMS sends (real
 * money, and the exact abuse vector TR-04 exists to bound) or unlimited
 * credential-stuffing attempts against admin accounts.
 *
 * Throws ServiceUnavailableError if Redis itself is down.
 * Throws RateLimitedError (via the caller checking the return value) is NOT
 * done here — callers decide what error/response shape fits their route,
 * this function only reports whether the limit was exceeded.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; count: number }> {
  let count: number;
  try {
    const multi = redis.multi();
    multi.incr(key);
    multi.expire(key, windowSeconds, "NX");
    const results = await multi.exec();
    if (!results) {
      throw new Error("Redis MULTI returned null (connection issue)");
    }
    const [incrResult] = results;
    const [incrErr, incrValue] = incrResult as [Error | null, number];
    if (incrErr) throw incrErr;
    count = incrValue;
  } catch (err) {
    throw new ServiceUnavailableError(undefined, err);
  }

  return { allowed: count <= limit, count };
}
