import { Worker, type Job } from "bullmq";
import { db } from "../db/client.js";
import { env } from "../env.js";
import { createBullMQConnection, scheduleVerificationSweep, VERIFICATION_SWEEP_QUEUE } from "./queue.js";
import { runVerificationExpirySweep } from "./verificationExpirySweep.js";

/**
 * A separate process from the API (`npm run worker`), per Nikhil §5.5 — a
 * second process on the single EC2 instance that can die silently if
 * nothing notices. Minimum viable observability for this sprint: a restart
 * policy at the process-manager level (systemd/pm2, outside this repo) plus
 * a log line per sweep run, below.
 */
async function main() {
  await scheduleVerificationSweep();

  const worker = new Worker(
    VERIFICATION_SWEEP_QUEUE,
    async (job: Job) => {
      console.warn(`[worker] running job '${job.name}' (${job.id})...`);
      const result = await runVerificationExpirySweep(db);
      console.warn(`[worker] sweep complete: checked ${result.checked}, suspended ${result.suspended}`);
      return result;
    },
    { connection: createBullMQConnection(), prefix: env.BULLMQ_PREFIX }
  );

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed:`, err);
  });

  console.warn(`[worker] listening on queue '${VERIFICATION_SWEEP_QUEUE}' (cron: daily at 03:00)`);

  const shutdown = async () => {
    console.warn("[worker] shutting down...");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[worker] fatal error during startup:", err);
  process.exit(1);
});
