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

  // --- Storage provider (05-sprint-2-detailed-plan.md §2.7) ---
  STORAGE_PROVIDER: z.enum(["mock", "s3"]).default("mock"),
  STORAGE_MOCK_DIR: z.string().default(".mock-storage"),
  STORAGE_MOCK_BASE_URL: z.string().default("http://localhost:3000/mock-storage"),
  S3_BUCKET_PUBLIC: z.string().optional(),
  S3_BUCKET_PRIVATE: z.string().optional(),
  S3_REGION: z.string().optional(),
  PRESIGNED_UPLOAD_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  PRESIGNED_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // --- Maps provider (§2.7) ---
  MAPS_PROVIDER: z.enum(["mock", "mapbox"]).default("mock"),
  MAPBOX_TOKEN: z.string().optional(), // secret token, server-side geocoding only — never shipped to a client bundle

  // --- BullMQ (§2.6) — reuses REDIS_URL above ---
  BULLMQ_PREFIX: z.string().default("parkaway"),

  // --- Payout encryption (§2.3's payout note) ---
  PAYOUT_ENCRYPTION_KEY: z.string().optional(), // 64 hex chars = 32 bytes; required outside test/dev-without-payouts
  PAYOUT_KEY_VERSION: z.coerce.number().int().positive().default(1),
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
}).superRefine((data, ctx) => {
  // Boot fails loudly if PAYOUT_ENCRYPTION_KEY is present but malformed —
  // never silently falls back to storing plaintext (§2.3's payout note,
  // lib/fieldCrypto.ts). Genuinely optional only when nothing in this
  // environment will ever write a payout row (test/CI, or dev before a host
  // enters one) — the production check below makes it non-optional there.
  if (data.PAYOUT_ENCRYPTION_KEY === undefined) return;
  if (!/^[0-9a-f]{64}$/i.test(data.PAYOUT_ENCRYPTION_KEY)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PAYOUT_ENCRYPTION_KEY"],
      message: "must be exactly 64 hex characters (32 bytes) — generate with `openssl rand -hex 32`",
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
  // Both new *_PROVIDER=mock values join the production-boot refusal list —
  // structurally impossible, not "off by default" (05-sprint-2-detailed-plan.md
  // §2.7, extending the same guard rather than writing a second one).
  if (env.STORAGE_PROVIDER === "mock") violations.push("STORAGE_PROVIDER=mock");
  if (env.MAPS_PROVIDER === "mock") violations.push("MAPS_PROVIDER=mock");

  if (violations.length > 0) {
    console.error(
      `FATAL: refusing to boot in production with bypass config active: ${violations.join(", ")}. ` +
        "This is an OTP/storage/maps bypass and cannot be allowed to run in production under any circumstances."
    );
    process.exit(1);
  }
}

/**
 * A stored payout account number is only as safe as the key that encrypts
 * it, and that key must never be absent in production (§2.3's payout note:
 * "boot fails loudly ... rather than silently falling back to storing
 * plaintext"). Checked separately from the bypass guard above because this
 * isn't a bypass — it's a missing secret that would otherwise make
 * `encryptField` either throw at first use or (worse, if someone "fixed"
 * that by relaxing it) write plaintext.
 */
function assertPayoutKeyInProduction() {
  if (env.NODE_ENV !== "production") return;
  if (!env.PAYOUT_ENCRYPTION_KEY) {
    console.error("FATAL: PAYOUT_ENCRYPTION_KEY must be set in production before any host can enter a payout account.");
    process.exit(1);
  }
}

assertNoBypassInProduction();
assertPayoutKeyInProduction();
