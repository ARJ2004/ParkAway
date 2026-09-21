import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { otpChallenges, users } from "../../db/schema.js";
import { env } from "../../env.js";
import { recordAudit } from "../../lib/audit.js";
import { generateNumericOtp, sha256Hex } from "../../lib/crypto.js";
import { ConflictError, RateLimitedError, UnauthorizedError } from "../../lib/errors.js";
import { normalizePhone } from "../../lib/normalize.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import type { OtpProvider } from "../../providers/otp/index.js";
import { issueSession, type IssuedSession } from "./session.service.js";

export interface RequestOtpParams {
  phone: string;
  ip: string;
  otpProvider: OtpProvider;
}

export async function requestOtp(db: Db, params: RequestOtpParams): Promise<void> {
  const phone = normalizePhone(params.phone);

  const [phoneLimit, ipLimit] = await Promise.all([
    checkRateLimit(`otp:req:phone:${phone}`, env.OTP_REQUEST_LIMIT_PER_PHONE_PER_HOUR, 3600),
    checkRateLimit(`otp:req:ip:${params.ip}`, env.OTP_REQUEST_LIMIT_PER_IP_PER_HOUR, 3600),
  ]);

  if (!phoneLimit.allowed || !ipLimit.allowed) {
    await recordAudit(db, {
      actorType: "system",
      action: "auth.otp_request_rate_limited",
      source: params.ip,
      metadata: { phone, phoneCount: phoneLimit.count, ipCount: ipLimit.count },
    });
    throw new RateLimitedError("Too many OTP requests for this number — please try again later");
  }

  const code = generateNumericOtp(env.OTP_LENGTH);
  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  await db.insert(otpChallenges).values({
    phone,
    codeHash: sha256Hex(code),
    purpose: "login",
    expiresAt,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
  });

  await params.otpProvider.send(phone, code);

  await recordAudit(db, {
    actorType: "system",
    action: "auth.otp_requested",
    source: params.ip,
    metadata: { phone },
  });
}

export interface VerifyOtpParams {
  phone: string;
  code: string;
  ip: string;
  deviceLabel?: string;
}

export interface VerifyOtpResult extends IssuedSession {
  userId: string;
  isNewUser: boolean;
}

export async function verifyOtp(db: Db, params: VerifyOtpParams): Promise<VerifyOtpResult> {
  const phone = normalizePhone(params.phone);

  const [challenge] = await db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date())))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);

  if (!challenge) {
    throw new UnauthorizedError("OTP_EXPIRED_OR_NOT_FOUND", "OTP expired or not found — please request a new one");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    throw new UnauthorizedError("OTP_INVALIDATED", "Too many incorrect attempts — please request a new OTP");
  }

  const devBypassMatches =
    env.SMS_PROVIDER === "mock" && !!env.DEV_OTP_BYPASS_CODE && params.code === env.DEV_OTP_BYPASS_CODE;
  const codeMatches = devBypassMatches || sha256Hex(params.code) === challenge.codeHash;

  if (!codeMatches) {
    const [updated] = await db
      .update(otpChallenges)
      .set({ attempts: sql`${otpChallenges.attempts} + 1` })
      .where(eq(otpChallenges.id, challenge.id))
      .returning({ attempts: otpChallenges.attempts, maxAttempts: otpChallenges.maxAttempts });

    const exhausted = !!updated && updated.attempts >= updated.maxAttempts;

    await recordAudit(db, {
      actorType: "system",
      action: exhausted ? "auth.otp_verify_exhausted" : "auth.otp_verify_failed",
      source: params.ip,
      metadata: { phone },
    });

    if (exhausted) {
      throw new UnauthorizedError("OTP_INVALIDATED", "Too many incorrect attempts — please request a new OTP");
    }
    const remaining = updated ? updated.maxAttempts - updated.attempts : 0;
    throw new UnauthorizedError("OTP_INCORRECT", `Incorrect OTP — ${remaining} attempt(s) remaining`);
  }

  // Atomic single-use consumption: only the request that wins this UPDATE
  // treats the code as valid. A racing duplicate submission loses here and
  // gets OTP_ALREADY_USED rather than silently minting a second session for
  // the same physical code entry (see docs/planning/04-sprint-1-detailed-plan.md
  // concurrency plan — single-use consumption is the security-authoritative
  // mechanism; the users.phone unique constraint below is defense-in-depth on
  // top of it, not the primary idempotency guard).
  const [consumed] = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, challenge.id), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id });

  if (!consumed) {
    throw new ConflictError("OTP_ALREADY_USED", "This OTP has already been used");
  }

  const { userId, isNewUser, sessionVersion, status } = await findOrCreateUser(db, phone);

  if (status === "suspended") {
    await recordAudit(db, {
      actorType: "system",
      action: "auth.login_rejected_suspended",
      targetType: "user",
      targetId: userId,
      source: params.ip,
    });
    throw new UnauthorizedError("ACCOUNT_SUSPENDED", "This account has been suspended");
  }

  const session = await issueSession(db, "driver", userId, sessionVersion, { deviceLabel: params.deviceLabel });

  await recordAudit(db, {
    actorType: "driver",
    actorId: userId,
    action: isNewUser ? "auth.signup_success" : "auth.login_success",
    targetType: "user",
    targetId: userId,
    source: params.ip,
  });

  return { ...session, userId, isNewUser };
}

async function findOrCreateUser(
  db: Db,
  phone: string
): Promise<{ userId: string; isNewUser: boolean; sessionVersion: number; status: string }> {
  const [existing] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (existing) {
    return { userId: existing.id, isNewUser: false, sessionVersion: existing.sessionVersion, status: existing.status };
  }

  try {
    const [created] = await db.insert(users).values({ phone }).returning();
    if (!created) throw new Error("Insert returned no row");
    return { userId: created.id, isNewUser: true, sessionVersion: created.sessionVersion, status: created.status };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // Unique-violation fallback: a concurrent request for the same brand-new
    // phone number won the insert race — load the account it created instead
    // of erroring, so the outcome stays idempotent (one user, this request
    // still gets a valid session). Anything other than a unique violation is
    // a real failure and must propagate, not be silently swallowed.
    const [existingAfterRace] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (!existingAfterRace) throw new Error("User insert failed and no existing row found", { cause: err });
    return {
      userId: existingAfterRace.id,
      isNewUser: false,
      sessionVersion: existingAfterRace.sessionVersion,
      status: existingAfterRace.status,
    };
  }
}
