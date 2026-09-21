import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Kept as a single file (rather than one-file-per-table with cross-imports)
// deliberately: drizzle-kit's schema loader has trouble resolving relative
// imports that carry the `.js` extension our tsconfig's NodeNext module
// resolution otherwise requires everywhere else in this codebase. One file
// with no internal cross-imports sidesteps that entirely. Revisit if the
// schema grows large enough that this becomes unwieldy.

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull().unique(), // E.164 normalized, e.g. +919876543210
    name: text("name"),
    email: text("email"),
    photoUrl: text("photo_url"), // S3 key, private bucket, presigned GET
    commPrefs: jsonb("comm_prefs").$type<{
      push?: boolean;
      sms?: boolean;
      whatsapp?: boolean;
      email?: boolean;
    }>(),
    status: text("status").notNull().default("active"),
    // Bumped on suspend/logout-all; embedded in access JWTs, checked against
    // the cached/DB value on every authenticated request (see session.service.ts).
    sessionVersion: integer("session_version").notNull().default(0),
    onboardingWizardCompletedAt: timestamp("onboarding_wizard_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check("users_status_check", sql`${table.status} in ('active', 'suspended')`),
  })
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(), // hash, never store the raw OTP
    purpose: text("purpose").notNull().default("login"), // room for 'phone_change' later
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneCreatedAtIdx: index("otp_challenges_phone_created_at_idx").on(table.phone, table.createdAt),
    purposeCheck: check("otp_challenges_purpose_check", sql`${table.purpose} in ('login', 'phone_change')`),
  })
);

export type OtpChallenge = typeof otpChallenges.$inferSelect;
export type NewOtpChallenge = typeof otpChallenges.$inferInsert;

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userType: text("user_type").notNull(), // 'driver' | 'admin' (shared table, discriminated)
    userId: uuid("user_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(), // store hash, never the raw token
    deviceLabel: text("device_label"), // best-effort UA/device string
    // Constant for the life of a login session; set once at initial login and
    // copied unchanged through every rotation. Reuse-detected revoke is a single
    // `UPDATE ... WHERE family_id = $1`, not a parent_id chain walk.
    familyId: uuid("family_id").notNull(),
    // Kept for forensic/debugging traceability only — not the revoke mechanism.
    parentId: uuid("parent_id"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userTypeUserIdIdx: index("refresh_tokens_user_type_user_id_idx").on(table.userType, table.userId),
    familyIdIdx: index("refresh_tokens_family_id_idx").on(table.familyId),
    userTypeCheck: check("refresh_tokens_user_type_check", sql`${table.userType} in ('driver', 'admin')`),
  })
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    registrationNo: text("registration_no").notNull(), // normalized: uppercase, no whitespace
    type: text("type").notNull(), // hatchback | sedan | suv | bike | commercial
    makeModel: text("make_model"),
    isDefault: boolean("is_default").notNull().default(false),
    status: text("status").notNull().default("active"), // active | inactive
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Partial unique index: duplicate check is scoped to active vehicles only,
    // and only within the same user_id. Sprint 1 open item (see docs/planning/
    // 04-sprint-1-detailed-plan.md, Risk #6): this does NOT prevent two
    // different users from both having the same plate active simultaneously —
    // that's an explicit product decision still pending, not an oversight.
    userIdRegistrationNoActiveIdx: uniqueIndex("vehicles_user_id_registration_no_active_idx")
      .on(table.userId, table.registrationNo)
      .where(sql`${table.status} = 'active'`),
    // Database-enforced "at most one default vehicle per user" — this is the
    // real correctness guarantee, not the application-level unset-then-set
    // transaction alone. Two concurrent set-default calls for two different
    // vehicles can both pass an application-level "unset the previous
    // default" step under READ COMMITTED before either commits its own new
    // default; only a constraint the database itself enforces closes that
    // race (see the concurrency test in test/integration/concurrency.test.ts,
    // which caught this before this index existed).
    userIdDefaultUniqueIdx: uniqueIndex("vehicles_user_id_default_unique_idx")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
    typeCheck: check("vehicles_type_check", sql`${table.type} in ('hatchback', 'sedan', 'suv', 'bike', 'commercial')`),
    statusCheck: check("vehicles_status_check", sql`${table.status} in ('active', 'inactive')`),
  })
);

export type Vehicle = typeof vehicles.$inferSelect;
export type NewVehicle = typeof vehicles.$inferInsert;

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull(), // 'platform_admin' | 'support'
    mfaSecret: text("mfa_secret"), // nullable, scaffolded, unused this sprint
    mfaRequired: boolean("mfa_required").notNull().default(false),
    status: text("status").notNull().default("active"),
    sessionVersion: integer("session_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roleCheck: check("admin_users_role_check", sql`${table.role} in ('platform_admin', 'support')`),
    statusCheck: check("admin_users_status_check", sql`${table.status} in ('active', 'suspended')`),
  })
);

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: text("actor_type").notNull(), // 'driver' | 'admin' | 'system'
    actorId: uuid("actor_id"),
    action: text("action").notNull(), // e.g. 'user.suspend', 'profile.email_change', 'login.otp_success'
    targetType: text("target_type"), // 'user' | 'vehicle' | 'admin_user'
    targetId: uuid("target_id"),
    reason: text("reason"),
    source: text("source"), // ip / device
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    targetIdx: index("audit_log_target_idx").on(table.targetType, table.targetId),
    actorIdx: index("audit_log_actor_idx").on(table.actorType, table.actorId),
  })
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
