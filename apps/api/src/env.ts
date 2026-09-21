import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// Single .env lives at the monorepo root (docker-compose, the api, and any
// future workspace all read the same one) rather than one per workspace.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  SESSION_VERSION_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),

  SMS_PROVIDER: z.enum(["mock", "real"]).default("mock"),
  DEV_OTP_BYPASS_CODE: z.string().optional(),
  OTP_LENGTH: z.coerce.number().int().positive().default(6),
  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_REQUEST_LIMIT_PER_PHONE_PER_HOUR: z.coerce.number().int().positive().default(5),
  OTP_REQUEST_LIMIT_PER_IP_PER_HOUR: z.coerce.number().int().positive().default(20),

  ADMIN_LOGIN_RATE_LIMIT_PER_ACCOUNT_PER_15MIN: z.coerce.number().int().positive().default(5),
  ADMIN_LOGIN_RATE_LIMIT_PER_IP_PER_15MIN: z.coerce.number().int().positive().default(20),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
}).superRefine((data, ctx) => {
  // DEV_OTP_BYPASS_CODE is compared against whatever the OTP input UI
  // collects, which is always OTP_LENGTH digits — a mismatch here (e.g. a
  // 4-digit bypass code against a 6-digit OTP_LENGTH) means the bypass
  // silently never matches what a tester actually types. Catch it at boot
  // rather than as a confusing "wrong code" during manual testing.
  if (data.DEV_OTP_BYPASS_CODE === undefined) return;
  if (!/^\d+$/.test(data.DEV_OTP_BYPASS_CODE)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["DEV_OTP_BYPASS_CODE"], message: "must be numeric digits only" });
  }
  if (data.DEV_OTP_BYPASS_CODE.length !== data.OTP_LENGTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["DEV_OTP_BYPASS_CODE"],
      message: `must be exactly OTP_LENGTH (${data.OTP_LENGTH}) digits long — got ${data.DEV_OTP_BYPASS_CODE.length}`,
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Non-negotiable rule #5: bypass/mock providers must be structurally impossible
 * to enable in production, not just "off by default". A misconfigured .env
 * on the production host must fail loudly at boot, not silently run with an
 * OTP bypass live.
 */
function assertNoBypassInProduction() {
  if (env.NODE_ENV !== "production") return;

  const violations: string[] = [];
  if (env.SMS_PROVIDER === "mock") violations.push("SMS_PROVIDER=mock");
  if (env.DEV_OTP_BYPASS_CODE) violations.push("DEV_OTP_BYPASS_CODE is set");

  if (violations.length > 0) {
    console.error(
      `FATAL: refusing to boot in production with bypass config active: ${violations.join(", ")}. ` +
        "This is an OTP bypass and cannot be allowed to run in production under any circumstances."
    );
    process.exit(1);
  }
}

assertNoBypassInProduction();
