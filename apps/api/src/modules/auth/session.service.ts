import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db as defaultDb, type Db } from "../../db/client.js";
import { adminUsers, refreshTokens, users } from "../../db/schema.js";
import { env } from "../../env.js";
import { generateOpaqueToken, sha256Hex } from "../../lib/crypto.js";
import { UnauthorizedError } from "../../lib/errors.js";
import { redis } from "../../redis.js";
import { recordAudit } from "../../lib/audit.js";

export type UserType = "driver" | "admin";
export type AdminRole = "platform_admin" | "support";

export interface AccessTokenClaims {
  sub: string;
  userType: UserType;
  sessionVersion: number;
  role?: AdminRole;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
}

export function signAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL_SECONDS });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessTokenClaims;
  } catch {
    throw new UnauthorizedError("INVALID_ACCESS_TOKEN", "Invalid or expired access token");
  }
}

/**
 * Issues a brand-new session (new refresh-token family). Used at login —
 * never at refresh time, which rotates within the existing family instead.
 */
export async function issueSession(
  db: Db,
  userType: UserType,
  userId: string,
  sessionVersion: number,
  opts: { deviceLabel?: string; role?: AdminRole } = {}
): Promise<IssuedSession> {
  const familyId = randomUUID();
  const rawRefreshToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);

  await db.insert(refreshTokens).values({
    userType,
    userId,
    tokenHash: sha256Hex(rawRefreshToken),
    deviceLabel: opts.deviceLabel ?? null,
    familyId,
    parentId: null,
    expiresAt,
  });

  const accessToken = signAccessToken({
    sub: userId,
    userType,
    sessionVersion,
    ...(opts.role ? { role: opts.role } : {}),
  });

  return { accessToken, refreshToken: rawRefreshToken, accessTokenExpiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

/**
 * Rotates a refresh token. On reuse of an already-rotated-away token, treats
 * it as a compromise signal and revokes the entire session family with a
 * single indexed query (docs/planning/04-sprint-1-detailed-plan.md,
 * concurrency/idempotency plan).
 *
 * The "claim" step below — marking the presented token revoked — is a single
 * atomic `UPDATE ... WHERE token_hash = $1 AND revoked_at IS NULL` and is
 * deliberately the FIRST thing this function does, before any other read.
 * An earlier version of this function did a plain SELECT to check
 * `revoked_at`, then revoked+inserted inside a transaction afterward — under
 * two truly concurrent refresh calls presenting the SAME still-valid token,
 * both could pass the SELECT's "not yet revoked" check before either
 * transaction committed, producing two live child tokens from one parent.
 * Making the claim itself the atomic operation means exactly one concurrent
 * caller can ever win it; the other necessarily observes the row as already
 * revoked and is routed into the same reuse-detected/family-revoke path a
 * genuine attacker replay would hit. That's intentionally the safe failure
 * mode for a security-sensitive path: a legitimate client that double-fires
 * a refresh call is forced to re-login, rather than the server ever risking
 * two divergent valid sessions from one rotation.
 */
export async function rotateRefreshToken(
  db: Db,
  rawRefreshToken: string,
  source: string | null
): Promise<IssuedSession> {
  const tokenHash = sha256Hex(rawRefreshToken);

  const [claimed] = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
    .returning();

  if (!claimed) {
    const [existing] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash)).limit(1);

    if (!existing) {
      throw new UnauthorizedError("INVALID_REFRESH_TOKEN", "Refresh token not recognized");
    }

    // Either a genuine replay of an already-rotated token, or the losing side
    // of a concurrent-refresh race against the same token — both are treated
    // identically: revoke the whole family and require re-login.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, existing.familyId), isNull(refreshTokens.revokedAt)));

    await recordAudit(db, {
      actorType: existing.userType as "driver" | "admin",
      actorId: existing.userId,
      action: "auth.refresh_reuse_detected",
      targetType: existing.userType === "admin" ? "admin_user" : "user",
      targetId: existing.userId,
      source,
      metadata: { familyId: existing.familyId },
    });

    throw new UnauthorizedError("REFRESH_TOKEN_REUSE_DETECTED", "This session has been revoked — please log in again");
  }

  if (claimed.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("REFRESH_TOKEN_EXPIRED", "Refresh token expired — please log in again");
  }

  const userType = claimed.userType as UserType;
  const { sessionVersion, status, role } = await fetchCurrentAccountState(db, userType, claimed.userId);

  if (status === "suspended") {
    throw new UnauthorizedError("ACCOUNT_SUSPENDED", "This account is suspended");
  }

  const newRawToken = generateOpaqueToken();
  const newExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);

  await db.insert(refreshTokens).values({
    userType,
    userId: claimed.userId,
    tokenHash: sha256Hex(newRawToken),
    deviceLabel: claimed.deviceLabel,
    familyId: claimed.familyId,
    parentId: claimed.id,
    expiresAt: newExpiresAt,
  });

  await setCachedSessionVersion(userType, claimed.userId, sessionVersion);

  const accessToken = signAccessToken({
    sub: claimed.userId,
    userType,
    sessionVersion,
    ...(role ? { role } : {}),
  });

  return { accessToken, refreshToken: newRawToken, accessTokenExpiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

/** Revokes only the presented token — other device sessions are unaffected (multi-device is allowed). */
export async function revokeRefreshToken(db: Db, rawRefreshToken: string): Promise<void> {
  const tokenHash = sha256Hex(rawRefreshToken);
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
}

async function fetchCurrentAccountState(
  db: Db,
  userType: UserType,
  userId: string
): Promise<{ sessionVersion: number; status: string; role?: AdminRole }> {
  if (userType === "driver") {
    const [row] = await db
      .select({ sessionVersion: users.sessionVersion, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) throw new UnauthorizedError("ACCOUNT_NOT_FOUND", "Account no longer exists");
    return row;
  }

  const [row] = await db
    .select({ sessionVersion: adminUsers.sessionVersion, status: adminUsers.status, role: adminUsers.role })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1);
  if (!row) throw new UnauthorizedError("ACCOUNT_NOT_FOUND", "Account no longer exists");
  return { ...row, role: row.role as AdminRole };
}

function cacheKey(userType: UserType, userId: string): string {
  return `session_version:${userType}:${userId}`;
}

async function setCachedSessionVersion(userType: UserType, userId: string, version: number): Promise<void> {
  try {
    await redis.set(cacheKey(userType, userId), String(version), "EX", env.SESSION_VERSION_CACHE_TTL_SECONDS);
  } catch {
    // Best-effort cache population — a failure here just means the next
    // request falls back to Postgres again, which is the fail-safe path anyway.
  }
}

/**
 * Fail-SAFE (not fail-open) session-version check for the request-auth
 * middleware. A cache miss (including "Redis is down") NEVER means "assume
 * still valid" — it means "go check Postgres directly", per the plan's
 * explicit call-out that Redis being disposable/restartable must not
 * silently reopen the full access-token TTL as the suspension-enforcement
 * window.
 */
export async function checkSessionVersion(
  userType: UserType,
  userId: string,
  tokenSessionVersion: number
): Promise<void> {
  let currentVersion: number | null = null;

  try {
    const cached = await redis.get(cacheKey(userType, userId));
    if (cached !== null) {
      currentVersion = Number(cached);
    }
  } catch {
    currentVersion = null; // treat Redis errors identically to a cache miss
  }

  if (currentVersion === null) {
    currentVersion = await fetchSessionVersionFromDb(userType, userId);
    await setCachedSessionVersion(userType, userId, currentVersion);
  }

  if (currentVersion !== tokenSessionVersion) {
    throw new UnauthorizedError("SESSION_REVOKED", "This session is no longer valid — please log in again");
  }
}

async function fetchSessionVersionFromDb(userType: UserType, userId: string): Promise<number> {
  if (userType === "driver") {
    const [row] = await defaultDb
      .select({ sessionVersion: users.sessionVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) throw new UnauthorizedError("ACCOUNT_NOT_FOUND", "Account no longer exists");
    return row.sessionVersion;
  }
  const [row] = await defaultDb
    .select({ sessionVersion: adminUsers.sessionVersion })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1);
  if (!row) throw new UnauthorizedError("ACCOUNT_NOT_FOUND", "Account no longer exists");
  return row.sessionVersion;
}

/** Bumps session_version, forcing every existing access token for this account to fail its next check. */
export async function bumpSessionVersion(db: Db, userType: UserType, userId: string): Promise<void> {
  if (userType === "driver") {
    await db
      .update(users)
      .set({ sessionVersion: sql`session_version + 1`, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } else {
    await db.update(adminUsers).set({ sessionVersion: sql`session_version + 1` }).where(eq(adminUsers.id, userId));
  }
  try {
    await redis.del(cacheKey(userType, userId));
  } catch {
    // Cache will simply be stale until its TTL expires and the next check
    // falls back to Postgres — bounded by SESSION_VERSION_CACHE_TTL_SECONDS.
  }
}
