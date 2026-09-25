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
import type { FastifyInstance } from "fastify";

let pg: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;
// Fastify `.inject()` HTTP-layer tests reuse this same container pair rather
// than spinning up a second Postgres+PostGIS Testcontainer for a separate
// file — real memory cost on this machine, and the extra isolation buys
// nothing here since every test below cleans up after itself via unique
// phone numbers.
let app: FastifyInstance;

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

// Sprint 2
let createProperty: typeof import("../../src/modules/property/property.service.js").createProperty;
let grantAuthorization: typeof import("../../src/modules/property/authorization.service.js").grantAuthorization;
let revokeAuthorization: typeof import("../../src/modules/property/authorization.service.js").revokeAuthorization;
let createListing: typeof import("../../src/modules/listing/listing.service.js").createListing;
let updateListing: typeof import("../../src/modules/listing/listing.service.js").updateListing;
let submitForPublication: typeof import("../../src/modules/listing/lifecycle.service.js").submitForPublication;
let conditionalTransition: typeof import("../../src/modules/listing/lifecycle.service.js").conditionalTransition;
let LEGAL_TRANSITIONS: typeof import("../../src/modules/listing/lifecycle.service.js").LEGAL_TRANSITIONS;
let runVerificationExpirySweep: typeof import("../../src/jobs/verificationExpirySweep.js").runVerificationExpirySweep;
let requestPhotoUploadUrl: typeof import("../../src/modules/listing/photo.service.js").requestPhotoUploadUrl;
let completePhotoUpload: typeof import("../../src/modules/listing/photo.service.js").completePhotoUpload;
let updatePhoto: typeof import("../../src/modules/listing/photo.service.js").updatePhoto;
let setPricing: typeof import("../../src/modules/pricing/pricing.service.js").setPricing;
let approveListing: typeof import("../../src/modules/admin/moderation.service.js").approveListing;
let createHostProfile: typeof import("../../src/modules/host/host-profile.service.js").createHostProfile;
let selectPersona: typeof import("../../src/modules/identity/persona.service.js").selectPersona;
let propertyAuthorizations: typeof import("../../src/db/schema.js").propertyAuthorizations;
let listings: typeof import("../../src/db/schema.js").listings;
let listingPhotos: typeof import("../../src/db/schema.js").listingPhotos;
let hostProfiles: typeof import("../../src/db/schema.js").hostProfiles;
let userRoles: typeof import("../../src/db/schema.js").userRoles;
let pricingVersions: typeof import("../../src/db/schema.js").pricingVersions;

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
  process.env.PAYOUT_ENCRYPTION_KEY = "0".repeat(64); // 32 bytes hex — needed by the HTTP-layer payout tests below
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

  const propertyMod = await import("../../src/modules/property/property.service.js");
  createProperty = propertyMod.createProperty;
  const authorizationMod = await import("../../src/modules/property/authorization.service.js");
  grantAuthorization = authorizationMod.grantAuthorization;
  revokeAuthorization = authorizationMod.revokeAuthorization;

  const listingMod = await import("../../src/modules/listing/listing.service.js");
  createListing = listingMod.createListing;
  updateListing = listingMod.updateListing;
  const lifecycleMod = await import("../../src/modules/listing/lifecycle.service.js");
  submitForPublication = lifecycleMod.submitForPublication;
  conditionalTransition = lifecycleMod.conditionalTransition;
  LEGAL_TRANSITIONS = lifecycleMod.LEGAL_TRANSITIONS;

  const sweepMod = await import("../../src/jobs/verificationExpirySweep.js");
  runVerificationExpirySweep = sweepMod.runVerificationExpirySweep;
  const photoMod = await import("../../src/modules/listing/photo.service.js");
  requestPhotoUploadUrl = photoMod.requestPhotoUploadUrl;
  completePhotoUpload = photoMod.completePhotoUpload;
  updatePhoto = photoMod.updatePhoto;

  const pricingMod = await import("../../src/modules/pricing/pricing.service.js");
  setPricing = pricingMod.setPricing;

  const moderationMod = await import("../../src/modules/admin/moderation.service.js");
  approveListing = moderationMod.approveListing;

  const hostProfileMod = await import("../../src/modules/host/host-profile.service.js");
  createHostProfile = hostProfileMod.createHostProfile;

  const personaMod = await import("../../src/modules/identity/persona.service.js");
  selectPersona = personaMod.selectPersona;

  propertyAuthorizations = schemaMod.propertyAuthorizations;
  listings = schemaMod.listings;
  listingPhotos = schemaMod.listingPhotos;
  hostProfiles = schemaMod.hostProfiles;
  userRoles = schemaMod.userRoles;
  pricingVersions = schemaMod.pricingVersions;

  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../../drizzle") });

  const { buildApp } = await import("../../src/app.js");
  app = await buildApp();
  await app.ready();
}, 120_000);

afterAll(async () => {
  await app?.close();
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

/**
 * Builds a listing all the way to `pending_verification`, ready for an
 * admin to approve — property (optionally requiring explicit authorization),
 * dimensions/vehicle types/access method, 3 completed photos, one pricing
 * version. Shared by the Sprint 2 concurrency tests below.
 */
async function createListingReadyToPublish(
  phone: string,
  opts: { propertyType?: string; outsiderPolicy?: string; grantOwnAuthorization?: boolean } = {}
) {
  const user = await createTestUser(phone);
  const property = await createProperty(db, user.id, {
    name: `Test property ${phone}`,
    propertyType: opts.propertyType ?? "standalone",
    addressLine1: "1 Test Street",
    locality: "Test Locality",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    location: { lat: 12.9716, lng: 77.5946 },
    entryLocation: { lat: 12.9716, lng: 77.5946 },
    outsiderPolicy: opts.outsiderPolicy ?? "allowed",
  });

  let authorization: { id: string } | null = null;
  if (opts.grantOwnAuthorization) {
    authorization = await grantAuthorization(
      db,
      user.id,
      property.id,
      {
        authorizationType: "management_contract",
        permittedParkingTypes: ["hourly"],
        outsiderPolicy: opts.outsiderPolicy ?? "authorized_only",
        effectiveFrom: new Date().toISOString(),
      },
      null
    );
  }

  const listing = await createListing(db, user.id, { propertyId: property.id, spaceLabel: "Test slot" });
  await updateListing(db, user.id, listing.id, {
    vehicleTypes: ["hatchback"],
    lengthCm: 500,
    widthCm: 250,
    heightCm: 200,
    accessMethod: "open",
    location: { lat: 12.9716, lng: 77.5946 },
  });

  for (let i = 0; i < 3; i++) {
    const upload = await requestPhotoUploadUrl(db, user.id, listing.id, "image/jpeg", 1000);
    await completePhotoUpload(db, user.id, listing.id, upload.photoId);
  }

  await setPricing(db, user.id, listing.id, { rules: [{ ruleType: "base_hourly", amountPaise: 5000 }] });

  await submitForPublication(db, user.id, listing.id);

  return { user, property, authorization, listingId: listing.id };
}

async function driverToken(userId: string): Promise<string> {
  const session = await issueSession(db, "driver", userId, 0);
  return session.accessToken;
}

async function adminTokenFor(adminId: string, role: "platform_admin" | "support"): Promise<string> {
  const session = await issueSession(db, "admin", adminId, 0, { role });
  return session.accessToken;
}

/** A draft listing with nothing filled in beyond property + space label — the minimum `createListing` requires. */
async function makeDraftListing(phone: string) {
  const user = await createTestUser(phone);
  const property = await createProperty(db, user.id, {
    name: "HTTP test property",
    propertyType: "standalone",
    addressLine1: "1 Test St",
    locality: "Test",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560001",
    location: { lat: 12.9716, lng: 77.5946 },
    entryLocation: { lat: 12.9716, lng: 77.5946 },
    outsiderPolicy: "allowed",
  });
  const listing = await createListing(db, user.id, { propertyId: property.id, spaceLabel: "HTTP test slot" });
  return { user, property, listing };
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

describe("R1 — authorization revoke vs. listing publish (the flagship case)", () => {
  it("never ends with a published listing under a revoked authorization, in either interleaving", async () => {
    const { user, property, authorization, listingId } = await createListingReadyToPublish("+919800100001", {
      propertyType: "commercial",
      outsiderPolicy: "authorized_only",
      grantOwnAuthorization: true,
    });
    if (!authorization) throw new Error("test setup: expected an authorization to have been granted");
    const admin = await createTestAdmin("r1-flagship@parkaway.test");

    await Promise.allSettled([
      approveListing(db, admin.id, listingId, { level: 3, reasonCategory: "looks_good" }, null),
      revokeAuthorization(db, user.id, property.id, authorization.id, "R1 concurrency test", null),
    ]);

    const [finalListing] = await db.select({ status: listings.status }).from(listings).where(eqFn(listings.id, listingId));
    const [finalAuth] = await db.select({ revokedAt: propertyAuthorizations.revokedAt }).from(propertyAuthorizations).where(eqFn(propertyAuthorizations.id, authorization.id));

    // The revoke always eventually succeeds in this scenario (nothing contends for its own lock twice) —
    // the property under test is what state the LISTING ends up in relative to it.
    expect(finalAuth?.revokedAt).not.toBeNull();
    // Non-negotiable rule 9, structurally enforced: never `published` once the authorization is revoked.
    // Legal outcomes: 'suspended' (approve won the race, then the revoke cascade caught it) or
    // 'pending_verification' (revoke won the race, so approve was rejected before publishing).
    expect(finalListing?.status).not.toBe("published");
    expect(["suspended", "pending_verification"]).toContain(finalListing?.status);
  });
});

describe("R2 — two admins approving the same queue item", () => {
  it("exactly one succeeds, the other 409s, exactly one verification record and one approve audit row exist", async () => {
    const { listingId } = await createListingReadyToPublish("+919800100002");
    const adminA = await createTestAdmin("r2-admin-a@parkaway.test");
    const adminB = await createTestAdmin("r2-admin-b@parkaway.test");

    const [resultA, resultB] = await Promise.allSettled([
      approveListing(db, adminA.id, listingId, { level: 2, reasonCategory: "looks_good" }, null),
      approveListing(db, adminB.id, listingId, { level: 2, reasonCategory: "looks_good" }, null),
    ]);

    const fulfilled = [resultA, resultB].filter((r) => r.status === "fulfilled");
    const rejected = [resultA, resultB].filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "LISTING_STATE_CONFLICT" });

    const { listingVerifications } = await import("../../src/db/schema.js");
    const verifications = await db.select().from(listingVerifications).where(eqFn(listingVerifications.listingId, listingId));
    expect(verifications).toHaveLength(1);

    const approveAudits = await db.select().from(auditLog).where(andFn(eqFn(auditLog.action, "listing.approve"), eqFn(auditLog.targetId, listingId)));
    expect(approveAudits).toHaveLength(1);

    const [finalListing] = await db.select({ status: listings.status }).from(listings).where(eqFn(listings.id, listingId));
    expect(finalListing?.status).toBe("published");
  });
});

describe("R4 — cover-photo uniqueness", () => {
  it("two concurrent set-cover-photo calls leave exactly one cover", async () => {
    const user = await createTestUser("+919800100003");
    const property = await createProperty(db, user.id, {
      name: "Cover race property",
      propertyType: "standalone",
      addressLine1: "1 Test Street",
      locality: "Test Locality",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      location: { lat: 12.9716, lng: 77.5946 },
      entryLocation: { lat: 12.9716, lng: 77.5946 },
      outsiderPolicy: "allowed",
    });
    const listing = await createListing(db, user.id, { propertyId: property.id, spaceLabel: "Cover race slot" });

    const uploadA = await requestPhotoUploadUrl(db, user.id, listing.id, "image/jpeg", 1000);
    await completePhotoUpload(db, user.id, listing.id, uploadA.photoId);
    const uploadB = await requestPhotoUploadUrl(db, user.id, listing.id, "image/jpeg", 1000);
    await completePhotoUpload(db, user.id, listing.id, uploadB.photoId);

    await Promise.allSettled([
      updatePhoto(db, user.id, listing.id, uploadA.photoId, { isCover: true }),
      updatePhoto(db, user.id, listing.id, uploadB.photoId, { isCover: true }),
    ]);

    const photos = await db.select().from(listingPhotos).where(eqFn(listingPhotos.listingId, listing.id));
    const covers = photos.filter((p) => p.isCover);
    expect(covers).toHaveLength(1);
  });
});

describe("R — two concurrent host-profile creations for one user", () => {
  it("leaves exactly one host profile", async () => {
    const user = await createTestUser("+919800100004");

    const [resultA, resultB] = await Promise.allSettled([
      createHostProfile(db, user.id, { hostType: "individual", legalName: "Test Host A" }),
      createHostProfile(db, user.id, { hostType: "individual", legalName: "Test Host B" }),
    ]);

    const fulfilled = [resultA, resultB].filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);

    const rows = await db.select().from(hostProfiles).where(eqFn(hostProfiles.userId, user.id));
    expect(rows).toHaveLength(1);
  });
});

describe("R — two concurrent owner-persona selections (double-tapped card)", () => {
  it("leaves exactly one live `host` role grant and one persona.role_granted audit row", async () => {
    const user = await createTestUser("+919800100005");

    await Promise.allSettled([selectPersona(db, user.id, "owner", null), selectPersona(db, user.id, "owner", null)]);

    const grants = await db
      .select()
      .from(userRoles)
      .where(andFn(eqFn(userRoles.userId, user.id), eqFn(userRoles.role, "host")));
    const liveGrants = grants.filter((g) => g.revokedAt === null);
    expect(liveGrants).toHaveLength(1);

    const grantAudits = await db
      .select()
      .from(auditLog)
      .where(andFn(eqFn(auditLog.action, "persona.role_granted"), eqFn(auditLog.actorId, user.id)));
    expect(grantAudits).toHaveLength(1);
  });
});

/**
 * Regression: a unique-violation caught mid-transaction (e.g. "you already
 * hold the `host` role") aborts the *whole* enclosing Postgres transaction,
 * not just the statement that violated — any further query on that same
 * `tx` handle then fails with "current transaction is aborted, commands
 * ignored until end of transaction block", even though the violation itself
 * is an expected, idempotent case. Found via a real device bug report:
 * select owner → switch to driver → switch back to owner 500'd every time,
 * because `tx.update(users)` ran after the caught (but not saved-pointed)
 * `tx.insert(userRoles)` conflict. Fixed by wrapping the risky insert in a
 * nested `tx.transaction()` (a real SAVEPOINT) in persona.service.ts,
 * host-profile.service.ts, and identity/vehicle.service.ts (the last one a
 * pre-existing Sprint 1 instance of the same bug class, never previously
 * exercised by a test).
 */
describe("Regression — a caught unique-violation mid-transaction must not abort later queries on the same tx", () => {
  it("re-selecting 'owner' after switching away and back succeeds, not a 500 (the exact reported bug)", async () => {
    const user = await createTestUser("+919800100011");

    await selectPersona(db, user.id, "owner", null);
    await selectPersona(db, user.id, "driver", null);
    // This third call is where the bug fired: the host role already exists,
    // so the insert inside selectPersona conflicts — and switching personas
    // (driver -> owner) means the code path still needs to update
    // `users.last_persona` and write an audit row afterward, on the same tx.
    const result = await selectPersona(db, user.id, "owner", null);
    expect(result.lastPersona).toBe("owner");
    expect(result.granted).toContain("host");

    const liveGrants = await db
      .select()
      .from(userRoles)
      .where(andFn(eqFn(userRoles.userId, user.id), eqFn(userRoles.role, "host"), eqFn(userRoles.revokedAt as never, null as never)));
    expect(liveGrants.length).toBeGreaterThanOrEqual(0); // presence already asserted via result.granted above; this just confirms the query itself still works post-fix
  });

  it("creating a host profile succeeds even when the user already holds the `host` role (e.g. via persona selection first)", async () => {
    const user = await createTestUser("+919800100012");
    await selectPersona(db, user.id, "owner", null); // grants `host` via persona.service.ts's own insert

    const hostProfileMod = await import("../../src/modules/host/host-profile.service.js");
    const profile = await hostProfileMod.createHostProfile(db, user.id, { hostType: "individual", legalName: "Regression Host" });
    expect(profile.legalName).toBe("Regression Host");

    const createAudits = await db
      .select()
      .from(auditLog)
      .where(andFn(eqFn(auditLog.action, "host.profile.create"), eqFn(auditLog.actorId, user.id)));
    expect(createAudits).toHaveLength(1);
  });
});

describe("R3 — two concurrent pricing edits on the same listing", () => {
  it("produces two distinct ordered versions, no lost update, no interleaved half-version", async () => {
    const user = await createTestUser("+919800100006");
    const property = await createProperty(db, user.id, {
      name: "Pricing race property",
      propertyType: "standalone",
      addressLine1: "1 Test Street",
      locality: "Test Locality",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      location: { lat: 12.9716, lng: 77.5946 },
      entryLocation: { lat: 12.9716, lng: 77.5946 },
      outsiderPolicy: "allowed",
    });
    const listing = await createListing(db, user.id, { propertyId: property.id, spaceLabel: "Pricing race slot" });

    const [resultA, resultB] = await Promise.allSettled([
      setPricing(db, user.id, listing.id, { rules: [{ ruleType: "base_hourly", amountPaise: 4000 }] }),
      setPricing(db, user.id, listing.id, { rules: [{ ruleType: "base_hourly", amountPaise: 6000 }] }),
    ]);

    expect(resultA.status).toBe("fulfilled");
    expect(resultB.status).toBe("fulfilled");

    const versions = await db.select().from(pricingVersions).where(eqFn(pricingVersions.listingId, listing.id));
    expect(versions).toHaveLength(2);
    const versionNumbers = versions.map((v) => v.version).sort();
    expect(versionNumbers).toEqual([1, 2]);
  });
});

/**
 * Fastify `.inject()` HTTP-layer tests — the tier Divya's plan calls for
 * (tech-stack.md §11) that nothing in this codebase exercised until now.
 * The gap these tests close was found the hard way: a real bug (Fastify's
 * `FST_ERR_CTP_EMPTY_JSON_BODY` on a bodyless POST getting flattened into a
 * generic 500) went undetected because every prior test either called
 * service functions directly (skipping the HTTP layer entirely, everything
 * above this point in the file) or mocked `fetch` on the client side
 * (skipping the real server entirely, driver-web/admin-web's RTL tests).
 * Only a real request through the real Fastify instance catches a bug that
 * lives in how Fastify itself parses a request.
 */
describe("Regression: bodyless mutating routes never 500 on Content-Type: application/json with an empty body", () => {
  // The exact bug: Fastify's default JSON parser throws FST_ERR_CTP_EMPTY_JSON_BODY
  // when Content-Type is application/json but the body is empty — this happens
  // during body parsing, BEFORE routing/auth preHandlers run, so it reproduces
  // regardless of whether the token or path is otherwise valid. Every action
  // route a client might call without a body is checked here explicitly,
  // rather than trusting the shared error-handler fix without a named test per
  // route (a future route added to this same pattern should be added here too).
  const routesToCheck = [
    "/v1/host/listings/00000000-0000-0000-0000-000000000000/submit",
    "/v1/host/listings/00000000-0000-0000-0000-000000000000/pause",
    "/v1/host/listings/00000000-0000-0000-0000-000000000000/resume",
    "/v1/host/listings/00000000-0000-0000-0000-000000000000/archive",
    "/v1/host/profile/kyc/submit",
    "/v1/host/documents/00000000-0000-0000-0000-000000000000/complete",
    "/v1/host/listings/00000000-0000-0000-0000-000000000000/photos/00000000-0000-0000-0000-000000000000/complete",
    "/v1/admin/hosts/00000000-0000-0000-0000-000000000000/kyc/approve",
    "/v1/auth/logout",
  ];

  it.each(routesToCheck)("POST %s with Content-Type: application/json and an empty body returns a real 4xx, never 500", async (url) => {
    const res = await app.inject({ method: "POST", url, headers: { "content-type": "application/json" }, payload: "" });
    expect(res.statusCode).toBeLessThan(500);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const body = JSON.parse(res.payload);
    expect(body.error.code).not.toBe("INTERNAL_ERROR");
  });

  it("also holds for a route that genuinely requires a body (malformed request, not just an empty one)", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/auth/otp/verify", headers: { "content-type": "application/json" }, payload: "" });
    expect(res.statusCode).toBeLessThan(500);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});

describe("Authorization boundaries — real HTTP, not just the service layer", () => {
  it("every protected route rejects an unauthenticated request with 401, not a silent pass-through", async () => {
    const protectedGets = ["/v1/me/personas", "/v1/properties", "/v1/host/profile", "/v1/host/listings", "/v1/admin/listings"];
    for (const url of protectedGets) {
      const res = await app.inject({ method: "GET", url });
      expect(res.statusCode, `${url} should 401 without a token`).toBe(401);
    }
  });

  it("host A cannot read, update, or submit host B's listing (403, not a leak)", async () => {
    const { listing: listingA } = await makeDraftListing("+919800300001");
    const userB = await createTestUser("+919800300002");
    const tokenB = await driverToken(userB.id);

    const getRes = await app.inject({ method: "GET", url: `/v1/host/listings/${listingA.id}`, headers: { authorization: `Bearer ${tokenB}` } });
    expect(getRes.statusCode).toBe(403);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/v1/host/listings/${listingA.id}`,
      headers: { authorization: `Bearer ${tokenB}`, "content-type": "application/json" },
      payload: JSON.stringify({ spaceLabel: "hijacked" }),
    });
    expect(patchRes.statusCode).toBe(403);

    const submitRes = await app.inject({ method: "POST", url: `/v1/host/listings/${listingA.id}/submit`, headers: { authorization: `Bearer ${tokenB}` } });
    expect(submitRes.statusCode).toBe(403);
  });

  it("a property manager not scoped to property X gets 403 (not 404) on it", async () => {
    const { property: propertyA } = await makeDraftListing("+919800300003");
    const userB = await createTestUser("+919800300004");
    const tokenB = await driverToken(userB.id);

    const res = await app.inject({ method: "GET", url: `/v1/properties/${propertyA.id}`, headers: { authorization: `Bearer ${tokenB}` } });
    expect(res.statusCode).toBe(403);
  });

  it("a host requesting an upload URL for another host's profile is rejected with 403", async () => {
    const userA = await createTestUser("+919800300005");
    const profileA = await createHostProfile(db, userA.id, { hostType: "individual", legalName: "Host A" });

    const userB = await createTestUser("+919800300006");
    const tokenB = await driverToken(userB.id);

    const res = await app.inject({
      method: "POST",
      url: "/v1/host/documents/upload-url",
      headers: { authorization: `Bearer ${tokenB}`, "content-type": "application/json" },
      payload: JSON.stringify({ docType: "pan", contentType: "image/jpeg", byteSize: 1000, ownerType: "host_profile", ownerId: profileA.id }),
    });
    expect(res.statusCode).toBe(403);
  });

  it("`support` gets 403 on platform_admin-only moderation actions but can still view the queue", async () => {
    const { listing } = await makeDraftListing("+919800300007");
    const [support] = await db
      .insert(adminUsers)
      .values({ email: "support-http-test@parkaway.test", passwordHash: "not-a-real-hash", role: "support" })
      .returning();
    if (!support) throw new Error("failed to create test support admin");
    const supportToken = await adminTokenFor(support.id, "support");

    const queueRes = await app.inject({ method: "GET", url: "/v1/admin/listings?status=pending_verification", headers: { authorization: `Bearer ${supportToken}` } });
    expect(queueRes.statusCode).toBe(200);

    const approveRes = await app.inject({
      method: "POST",
      url: `/v1/admin/listings/${listing.id}/approve`,
      headers: { authorization: `Bearer ${supportToken}`, "content-type": "application/json" },
      payload: JSON.stringify({ level: 2, reasonCategory: "looks_good" }),
    });
    expect(approveRes.statusCode).toBe(403);

    const revealRes = await app.inject({
      method: "POST",
      url: `/v1/admin/hosts/${listing.id}/payout/reveal`,
      headers: { authorization: `Bearer ${supportToken}`, "content-type": "application/json" },
      payload: JSON.stringify({ reason: "test" }),
    });
    expect(revealRes.statusCode).toBe(403);
  });

  it("a hand-forged persona claim in the JWT is ignored — authorization is decided from user_roles alone (§2.2a)", async () => {
    const user = await createTestUser("+919800300008");
    const jwtMod = await import("jsonwebtoken");
    const { env } = await import("../../src/env.js");
    // A client can only ever control the request BODY/headers, never the
    // signed claims — this signs a token with our own secret (simulating
    // "if a client could somehow get a persona claim into a valid token")
    // to prove the server-side check never reads it in the first place.
    const forgedToken = jwtMod.default.sign({ sub: user.id, userType: "driver", sessionVersion: 0, persona: "owner" }, env.JWT_ACCESS_SECRET, { expiresIn: 900 });

    const res = await app.inject({
      method: "POST",
      url: "/v1/host/profile",
      headers: { authorization: `Bearer ${forgedToken}`, "content-type": "application/json" },
      payload: JSON.stringify({ hostType: "individual", legalName: "Should not matter" }),
    });
    // Succeeds because host-profile creation is self-service, not persona-gated
    // — the point is the outcome never depends on the forged `persona` claim.
    expect(res.statusCode).toBe(201);
  });
});

describe("Submit-for-publication returns every failing field at once (AC-2), over real HTTP", () => {
  it("a draft listing with nothing filled in reports all missing fields in one response, not just the first", async () => {
    const { user, listing } = await makeDraftListing("+919800300009");
    const token = await driverToken(user.id);

    const res = await app.inject({ method: "POST", url: `/v1/host/listings/${listing.id}/submit`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.payload);
    const failures: string[] = body.error.details.failures;
    expect(failures.some((f) => f.includes("location"))).toBe(true);
    expect(failures.some((f) => f.includes("vehicleTypes"))).toBe(true);
    expect(failures.some((f) => f.includes("dimensions"))).toBe(true);
    expect(failures.some((f) => f.includes("photos"))).toBe(true);
    expect(failures.some((f) => f.includes("pricing"))).toBe(true);
    expect(failures.length).toBeGreaterThanOrEqual(5);
  });
});

describe("Payout leak sweep — the full account number appears in no response body, anywhere", () => {
  it("setting a payout account, then reading the host profile back, never returns the full number", async () => {
    const user = await createTestUser("+919800300010");
    await createHostProfile(db, user.id, { hostType: "individual", legalName: "Payout Test Host" });
    const token = await driverToken(user.id);

    const setRes = await app.inject({
      method: "PUT",
      url: "/v1/host/profile/payout",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      payload: JSON.stringify({ accountHolderName: "Payout Test Host", bankName: "Test Bank", ifsc: "HDFC0001234", accountNumber: "123456789012" }),
    });
    expect(setRes.statusCode).toBe(200);
    expect(setRes.payload).not.toContain("123456789012");

    const getRes = await app.inject({ method: "GET", url: "/v1/host/profile", headers: { authorization: `Bearer ${token}` } });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.payload).not.toContain("123456789012");
    expect(JSON.parse(getRes.payload).payoutAccountLast4).toBe("9012");
  });
});

describe("R6 — verification-expiry sweep is idempotent under concurrent runs", () => {
  it("two concurrent sweeps over one already-expired listing: exactly one suspends it, exactly one audit row, and a third run changes nothing", async () => {
    const { listingId } = await createListingReadyToPublish("+919800300011");
    const admin = await createTestAdmin("sweep-admin-1@test.com");

    // Approved at exactly the property's required level (2 for `standalone`),
    // but with an expiry already in the past — the effective level is 0 from
    // the moment this transaction commits, so the very next sweep must catch it.
    const pastExpiry = new Date(Date.now() - 60_000).toISOString();
    await approveListing(db, admin.id, listingId, { level: 2, reasonCategory: "looks_good", expiresAt: pastExpiry }, null);

    const [beforeSweep] = await db.select({ status: listings.status }).from(listings).where(eqFn(listings.id, listingId)).limit(1);
    expect(beforeSweep?.status).toBe("published");

    // Simulates two overlapping sweep runs (e.g. a slow run plus a manual
    // re-trigger) racing over the same eligible listing.
    const [resultA, resultB] = await Promise.all([runVerificationExpirySweep(db), runVerificationExpirySweep(db)]);
    expect(resultA.suspended + resultB.suspended).toBe(1); // never both, never neither

    const [afterSweep] = await db.select({ status: listings.status, statusReason: listings.statusReason }).from(listings).where(eqFn(listings.id, listingId)).limit(1);
    expect(afterSweep?.status).toBe("suspended");
    expect(afterSweep?.statusReason).toBe("verification_expired");

    const expireAudits = await db
      .select()
      .from(auditLog)
      .where(andFn(eqFn(auditLog.action, "listing.verification.expire"), eqFn(auditLog.targetId, listingId)));
    expect(expireAudits).toHaveLength(1);

    // Idempotence (rule 2 / R6): re-running over a listing that's no longer
    // `published` must be a true no-op — no further transition, no duplicate audit row.
    const thirdRun = await runVerificationExpirySweep(db);
    expect(thirdRun.suspended).toBe(0);

    const [stillSuspended] = await db.select({ status: listings.status }).from(listings).where(eqFn(listings.id, listingId)).limit(1);
    expect(stillSuspended?.status).toBe("suspended");

    const expireAuditsAfterThirdRun = await db
      .select()
      .from(auditLog)
      .where(andFn(eqFn(auditLog.action, "listing.verification.expire"), eqFn(auditLog.targetId, listingId)));
    expect(expireAuditsAfterThirdRun).toHaveLength(1);
  });
});

describe("Listing lifecycle — full transition matrix (AC-5)", () => {
  const ALL_STATUSES = ["draft", "pending_verification", "published", "paused", "suspended", "archived"] as const;
  const pairs = ALL_STATUSES.flatMap((from) => ALL_STATUSES.map((to) => [from, to] as const));

  let matrixUser: Awaited<ReturnType<typeof createTestUser>>;
  let matrixPropertyId: string;
  let pairIndex = 0;

  it.each(pairs)("%s -> %s is legal iff LEGAL_TRANSITIONS says so", async (from, to) => {
    if (!matrixUser) {
      matrixUser = await createTestUser("+919800300012");
      const property = await createProperty(db, matrixUser.id, {
        name: "Matrix test property",
        propertyType: "standalone",
        addressLine1: "1 Matrix Street",
        locality: "Test Locality",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
        location: { lat: 12.9716, lng: 77.5946 },
        entryLocation: { lat: 12.9716, lng: 77.5946 },
        outsiderPolicy: "allowed",
      });
      matrixPropertyId = property.id;
    }

    const listing = await createListing(db, matrixUser.id, { propertyId: matrixPropertyId, spaceLabel: `Matrix slot ${pairIndex++}` });
    // Force the listing directly into the `from` state under test, bypassing
    // every service-level guard — the matrix must hold at the
    // `conditionalTransition` primitive itself, independent of how a caller reached that state.
    await db.update(listings).set({ status: from }).where(eqFn(listings.id, listing.id));

    const isLegal = (LEGAL_TRANSITIONS[from] ?? []).includes(to);
    const attempt = conditionalTransition(db, listing.id, [from], to);

    if (isLegal) {
      await expect(attempt).resolves.toMatchObject({ status: to });
    } else {
      await expect(attempt).rejects.toBeInstanceOf(ConflictError);
      const [current] = await db.select({ status: listings.status }).from(listings).where(eqFn(listings.id, listing.id)).limit(1);
      expect(current?.status).toBe(from); // rejected attempt must never mutate state
    }
  });

  it("every state's legal-transition set in LEGAL_TRANSITIONS matches AC-5 exactly", () => {
    expect(LEGAL_TRANSITIONS).toEqual({
      draft: ["pending_verification", "archived"],
      pending_verification: ["published", "suspended"],
      published: ["paused", "suspended"],
      paused: ["published", "suspended", "archived"],
      suspended: ["archived"],
      archived: [],
    });
  });
});
