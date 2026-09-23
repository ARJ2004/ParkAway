import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";

/**
 * BullMQ needs its own Redis connection with different settings from the
 * app's `redis.ts` client (rate limiting / session-version cache): BullMQ
 * requires `maxRetriesPerRequest: null` and relies on blocking commands that
 * `redis.ts` deliberately disables (`enableOfflineQueue: false`) for its own
 * fail-fast reasoning.
 */
export function createBullMQConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

export const VERIFICATION_SWEEP_QUEUE = "verification-expiry-sweep";
export const VERIFICATION_SWEEP_JOB_ID = "daily-verification-sweep";
export const VERIFICATION_SWEEP_CRON = "0 3 * * *"; // daily at 03:00

let queue: Queue | undefined;

export function getVerificationSweepQueue(): Queue {
  if (!queue) {
    queue = new Queue(VERIFICATION_SWEEP_QUEUE, { connection: createBullMQConnection(), prefix: env.BULLMQ_PREFIX });
  }
  return queue;
}

/**
 * Recurring cron trigger, per the job inventory in tech-stack.md §6 —
 * INV-02's verification-expiry sweep is this codebase's first job, standing
 * BullMQ up on a low-stakes daily sweep rather than next to Sprint 4's
 * money-bearing hold-expiry job (§2.6). Idempotent to call repeatedly: same
 * `jobId` + repeat pattern is a no-op on re-registration, not a duplicate
 * schedule.
 */
export async function scheduleVerificationSweep(): Promise<void> {
  const q = getVerificationSweepQueue();
  await q.add(
    "sweep",
    {},
    { repeat: { pattern: VERIFICATION_SWEEP_CRON }, jobId: VERIFICATION_SWEEP_JOB_ID }
  );
}
