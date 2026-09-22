/**
 * Concurrency/idempotency tests against REAL Postgres + Redis (Testcontainers),
 * per non-negotiable rule #12 and docs/planning/04-sprint-1-detailed-plan.md
 * ("Divya's" concurrency/idempotency cases). These specifically exercise the
 * races that a mock DB/cache cannot meaningfully simulate: true two-simultaneous-
 * request behavior against real row locking and real atomic UPDATE...WHERE
 * clauses.
 *
 * Env vars are set BEFORE any app module is imported (dynamic import below),
 * because env.ts/db/client.ts/redis.ts all initialize eagerly on import.
 */
import { GenericContainer, Wait, type StartedTestContainer } from "testcontainers";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";

let pg: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;

let db: typeof import("../../src/db/client.js").db;
let sqlClient: typeof import("../../src/db/client.js").sqlClient;
let redis: typeof import("../../src/redis.js").redis;
let verifyOtp: typeof import("../../src/modules/auth/otp.service.js").verifyOtp;
let requestOtp: typeof import("../../src/modules/auth/otp.service.js").requestOtp;
let rotateRefreshToken: typeof import("../../src/modules/auth/session.service.js").rotateRefreshToken;
let issueSession: typeof import("../../src/modules/auth/session.service.js").issueSession;
let revokeRefreshToken: typeof import("../../src/modules/auth/session.service.js").revokeRefreshToken;
let addVehicle: typeof import("../../src/modules/identity/vehicle.service.js").addVehicle;
let updateVehicle: typeof import("../../src/modules/identity/vehicle.service.js").updateVehicle;
let ConflictError: typeof import("../../src/lib/errors.js").ConflictError;
let users: typeof import("../../src/db/schema.js").users;
let vehicles: typeof import("../../src/db/schema.js").vehicles;
let refreshTokens: typeof import("../../src/db/schema.js").refreshTokens;
let auditLog: typeof import("../../src/db/schema.js").auditLog;
let adminUsers: typeof import("../../src/db/schema.js").adminUsers;
let eqFn: typeof import("drizzle-orm").eq;
let andFn: typeof import("drizzle-orm").and;
let descFn: typeof import("drizzle-orm").desc;

const REDIS_PASSWORD = "testpass";
const mockOtpProvider = { send: async () => {} };

beforeAll(async () => {
  pg = await new PostgreSqlContainer("postgis/postgis:16-3.4-alpine")
    .withDatabase("parkaway_test")
    .withUsername("parkaway")
    .withPassword("parkaway_test_pw")
    .start();

  redisContainer = await new GenericContainer("redis:7-alpine")
    .withCommand(["redis-server", "--requirepass", REDIS_PASSWORD])
    .withExposedPorts(6379)
    .withWaitStrategy(Wait.forLogMessage("Ready to accept connections"))
    .start();

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = pg.getConnectionUri();
  process.env.REDIS_URL = `redis://:${REDIS_PASSWORD}@${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env.JWT_ACCESS_SECRET = "test-secret-at-least-32-characters-long";
  process.env.SMS_PROVIDER = "mock";
  process.env.DEV_OTP_BYPASS_CODE = "123456"; // must match OTP_LENGTH (6) — see env.ts's boot-time validation
  delete process.env.SEED_ADMIN_EMAIL;
  delete process.env.SEED_ADMIN_PASSWORD;

  const dbClientMod = await import("../../src/db/client.js");
  db = dbClientMod.db;
  sqlClient = dbClientMod.sqlClient;

  const redisMod = await import("../../src/redis.js");
  redis = redisMod.redis;

  const otpMod = await import("../../src/modules/auth/otp.service.js");
  verifyOtp = otpMod.verifyOtp;
  requestOtp = otpMod.requestOtp;

  const sessionMod = await import("../../src/modules/auth/session.service.js");
  rotateRefreshToken = sessionMod.rotateRefreshToken;
  issueSession = sessionMod.issueSession;
  revokeRefreshToken = sessionMod.revokeRefreshToken;

  const vehicleMod = await import("../../src/modules/identity/vehicle.service.js");
  addVehicle = vehicleMod.addVehicle;
  updateVehicle = vehicleMod.updateVehicle;

  const errorsMod = await import("../../src/lib/errors.js");
  ConflictError = errorsMod.ConflictError;

  const schemaMod = await import("../../src/db/schema.js");
  users = schemaMod.users;
  vehicles = schemaMod.vehicles;
  refreshTokens = schemaMod.refreshTokens;
  auditLog = schemaMod.auditLog;
  adminUsers = schemaMod.adminUsers;

  const drizzleOrm = await import("drizzle-orm");
  eqFn = drizzleOrm.eq;
  andFn = drizzleOrm.and;
  descFn = drizzleOrm.desc;

  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });
}, 120_000);

afterAll(async () => {
  await sqlClient?.end();
  redis?.disconnect();
  await pg?.stop();
  await redisContainer?.stop();
});

async function createTestUser(phone: string) {
  const [u] = await db.insert(users).values({ phone }).returning();
  if (!u) throw new Error("failed to create test user");
  return u;
}

async function createTestAdmin(email: string) {
  const [a] = await db
    .insert(adminUsers)
    .values({ email, passwordHash: "not-a-real-hash", role: "platform_admin" })
    .returning();
  if (!a) throw new Error("failed to create test admin");
  return a;
}

describe("OTP verify concurrency", () => {
  it("two concurrent verify calls with the same code: exactly one succeeds, one user row exists", async () => {
    const phone = "+919800000001";
    await requestOtp(db, { phone, ip: "127.0.0.1", otpProvider: mockOtpProvider });

    const [resultA, resultB] = await Promise.allSettled([
      verifyOtp(db, { phone, code: "123456", ip: "127.0.0.1" }),
      verifyOtp(db, { phone, code: "123456", ip: "127.0.0.1" }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((r) => r.status === "fulfilled");
    const rejected = outcomes.filter((r) => r.status === "rejected");

    // Single-use consumption: exactly one of the two racing requests wins.
    // The loser's exact error code depends on interleaving — if its own SELECT
    // still saw the (not-yet-consumed) row, it loses the atomic UPDATE claim
    // and gets OTP_ALREADY_USED; if the winner's whole flow completed before
    // the loser's SELECT even ran, the loser's SELECT finds nothing and gets
    // OTP_EXPIRED_OR_NOT_FOUND. Both are correct rejections of the race loser
    // — the property under test is "exactly one winner, one user row", not
    // which specific error the loser sees.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(["OTP_ALREADY_USED", "OTP_EXPIRED_OR_NOT_FOUND"]).toContain(
      (rejected[0] as PromiseRejectedResult).reason.code
    );

    const rows = await db.select().from(users).where(eqFn(users.phone, phone));
    expect(rows).toHaveLength(1);
  });
});

describe("Refresh-token rotation concurrency", () => {
  it("two concurrent refresh calls with the same token: the family never ends up with more than one live token", async () => {
    const user = await createTestUser("+919800000002");
    const session = await issueSession(db, "driver", user.id, 0);

    const { sha256Hex } = await import("../../src/lib/crypto.js");
    const [originalRow] = await db
      .select()
      .from(refreshTokens)
      .where(eqFn(refreshTokens.tokenHash, sha256Hex(session.refreshToken)));
    if (!originalRow) throw new Error("original refresh token row not found");

    const [resultA, resultB] = await Promise.allSettled([
      rotateRefreshToken(db, session.refreshToken, "127.0.0.1"),
      rotateRefreshToken(db, session.refreshToken, "127.0.0.1"),
    ]);

    const fulfilled = [resultA, resultB].filter((r) => r.status === "fulfilled");
    // At most one racer can win the atomic claim — this is the actual bug the
    // earlier SELECT-then-transaction implementation had (see the comment on
    // rotateRefreshToken in session.service.ts): both could win before either
    // committed, producing two live children from one parent.
    expect(fulfilled.length).toBeLessThanOrEqual(1);

    const family = await db.select().from(refreshTokens).where(eqFn(refreshTokens.familyId, originalRow.familyId));
    const liveInFamily = family.filter((r) => r.revokedAt === null);
    expect(liveInFamily.length).toBeLessThanOrEqual(1);
  });
});

describe("Vehicle default-swap concurrency", () => {
  it("two concurrent set-default calls for two different vehicles: exactly one ends up default", async () => {
    const user = await createTestUser("+919800000003");
    const v1 = await addVehicle(db, user.id, { registrationNo: "MH01AA0001", type: "hatchback" });
    const v2 = await addVehicle(db, user.id, { registrationNo: "MH01AA0002", type: "sedan" });

    await Promise.allSettled([
      updateVehicle(db, user.id, v1.id, { isDefault: true }),
      updateVehicle(db, user.id, v2.id, { isDefault: true }),
    ]);

    const rows = await db.select().from(vehicles).where(eqFn(vehicles.userId, user.id));
    const defaults = rows.filter((r) => r.isDefault);
    expect(defaults).toHaveLength(1);
  });
});

describe("Vehicle registration uniqueness (global, not per-user)", () => {
  it("rejects a second user registering a plate that's already active on a different account", async () => {
    const owner = await createTestUser("+919800000004");
    const buyer = await createTestUser("+919800000005");

    await addVehicle(db, owner.id, { registrationNo: "KA05HR1096", type: "sedan" });

    const attempt = addVehicle(db, buyer.id, { registrationNo: "KA05HR1096", type: "sedan" });
    await expect(attempt).rejects.toBeInstanceOf(ConflictError);
    await expect(attempt).rejects.toMatchObject({ code: "DUPLICATE_VEHICLE" });
  });

  it("allows the plate again once the previous owner deactivates their vehicle", async () => {
    const owner = await createTestUser("+919800000006");
    const buyer = await createTestUser("+919800000007");

    const sold = await addVehicle(db, owner.id, { registrationNo: "KA05HR2000", type: "suv" });
    await updateVehicle(db, owner.id, sold.id, { status: "inactive" });

    const reregistered = await addVehicle(db, buyer.id, { registrationNo: "KA05HR2000", type: "suv" });
    expect(reregistered.registrationNo).toBe("KA05HR2000");
    expect(reregistered.userId).toBe(buyer.id);
  });
});

describe("Logout audit trail", () => {
  it("driver logout writes an auth.logout audit row for that driver", async () => {
    const user = await createTestUser("+919800000008");
    const session = await issueSession(db, "driver", user.id, 0);

    await revokeRefreshToken(db, session.refreshToken, "203.0.113.1");

    const rows = await db
      .select()
      .from(auditLog)
      .where(andFn(eqFn(auditLog.action, "auth.logout"), eqFn(auditLog.actorId, user.id)))
      .orderBy(descFn(auditLog.createdAt));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: "driver",
      targetType: "user",
      targetId: user.id,
      source: "203.0.113.1",
    });
  });

  it("admin logout writes an auth.logout audit row for that admin", async () => {
    const admin = await createTestAdmin("audit-test-admin@parkaway.test");
    const session = await issueSession(db, "admin", admin.id, 0, { role: "platform_admin" });

    await revokeRefreshToken(db, session.refreshToken, "203.0.113.2");

    const rows = await db
      .select()
      .from(auditLog)
      .where(andFn(eqFn(auditLog.action, "auth.logout"), eqFn(auditLog.actorId, admin.id)))
      .orderBy(descFn(auditLog.createdAt));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorType: "admin",
      targetType: "admin_user",
      targetId: admin.id,
      source: "203.0.113.2",
    });
  });

  it("revoking an unknown or already-revoked token is a silent no-op — no audit row, no throw", async () => {
    const before = await db.select().from(auditLog).where(eqFn(auditLog.action, "auth.logout"));

    await expect(revokeRefreshToken(db, "not-a-real-token", "203.0.113.3")).resolves.toBeUndefined();

    const user = await createTestUser("+919800000009");
    const session = await issueSession(db, "driver", user.id, 0);
    await revokeRefreshToken(db, session.refreshToken, "203.0.113.4"); // first revoke: real
    await expect(revokeRefreshToken(db, session.refreshToken, "203.0.113.5")).resolves.toBeUndefined(); // second: no-op

    const afterUnknown = await db.select().from(auditLog).where(eqFn(auditLog.action, "auth.logout"));
    // Exactly one new row from the real first revoke of `user`; the unknown-token
    // attempt and the double-revoke of the same token must not have added rows.
    expect(afterUnknown.length).toBe(before.length + 1);
  });
});
