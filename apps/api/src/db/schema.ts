import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Drizzle has no native `geography` column type. This customType only
 * declares the column's DDL shape (for drizzle-kit's diff/migration
 * generation) — actual reads and writes never go through it directly.
 * Writes use `geoPoint()` (lib/geo.ts) as a raw `sql` value in
 * `.values()`/`.set()`; reads use `selectLatLng()`/`withinMeters()`/
 * `distanceMeters()`. Keeping the column "opaque" to the typed query
 * builder is deliberate — a `geography` value round-tripped through
 * postgres.js's normal parameter encoding has no reliable JS
 * representation, and PostGIS's own SQL functions are the correct place
 * for every spatial operation anyway (non-negotiable rule 7).
 */
const geography = customType<{ data: never }>({
  dataType() {
    return "geography(Point, 4326)";
  },
});

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
    // Nullable is meaningful: null is what makes a user "first login" and
    // triggers the persona picker (05-sprint-2-detailed-plan.md, Group D).
    // A UI routing preference only — never consulted in an authorization
    // decision. See §2.2a and plugins/requireRole.ts.
    lastPersona: text("last_persona"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check("users_status_check", sql`${table.status} in ('active', 'suspended')`),
    lastPersonaCheck: check("users_last_persona_check", sql`${table.lastPersona} in ('driver', 'owner')`),
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
    // Partial unique index, GLOBAL (not scoped to user_id) — confirmed with
    // the user 2026-09-21, resolving the Sprint 1 open item in
    // docs/planning/04-sprint-1-detailed-plan.md (Risk #6). At most one
    // *active* vehicle row may exist for a given plate across the entire
    // system at a time — the same plate can never be active on two different
    // accounts simultaneously. A previous owner must deactivate their
    // vehicle record before a new owner can register the same plate.
    registrationNoActiveIdx: uniqueIndex("vehicles_registration_no_active_idx")
      .on(table.registrationNo)
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

// ---------------------------------------------------------------------------
// Sprint 2 — see docs/planning/05-sprint-2-detailed-plan.md §2.3 for full
// design rationale on every table below.
// ---------------------------------------------------------------------------

/**
 * A host and a property manager are neither of Sprint 1's two identity
 * tables — deliberately not a third identity table (§2.2, decided O-6).
 * Authorization is `requireRole('host')` / `requirePropertyScope(propertyId)`
 * reading this table, mirroring `requireAdminRole`. Persona (`users.last_persona`)
 * is never consulted here — see §2.2a.
 */
export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: text("role").notNull(), // 'host' | 'property_manager'
    scopeType: text("scope_type"), // null for 'host'; 'property' for 'property_manager'
    scopeId: uuid("scope_id"), // the property id when scoped
    grantedByType: text("granted_by_type").notNull(), // 'self' | 'admin'
    grantedByUserId: uuid("granted_by_user_id"), // admin_users.id when granted_by_type = 'admin'
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    // Partial unique index (immutable predicate) — one live grant per
    // (user, role, scope). Re-granting an already-granted role is a 200
    // no-op at the service layer, not a second row (see persona.service.ts).
    //
    // `scope_id` is NULL for an unscoped role (`host`) — and Postgres unique
    // indexes treat every NULL as distinct from every other NULL, so a plain
    // `.on(userId, role, scopeId)` provides NO uniqueness guarantee at all
    // for host grants (caught by the concurrent-double-persona-select
    // Testcontainers test in test/integration/concurrency.test.ts, which
    // found two live `host` rows for one user before this fix). Coalescing
    // to a fixed sentinel UUID makes NULL scope collide with itself the way
    // any other value would.
    liveGrantUniqueIdx: uniqueIndex("user_roles_live_grant_unique_idx")
      .on(table.userId, table.role, sql`coalesce(${table.scopeId}, '00000000-0000-0000-0000-000000000000'::uuid)`)
      .where(sql`${table.revokedAt} is null`),
    userIdIdx: index("user_roles_user_id_idx").on(table.userId),
    scopeIdx: index("user_roles_scope_idx").on(table.scopeType, table.scopeId),
    roleCheck: check("user_roles_role_check", sql`${table.role} in ('host', 'property_manager')`),
    scopeTypeCheck: check("user_roles_scope_type_check", sql`${table.scopeType} in ('property')`),
    grantedByTypeCheck: check("user_roles_granted_by_type_check", sql`${table.grantedByType} in ('self', 'admin')`),
  })
);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    propertyType: text("property_type").notNull(), // 'society' | 'commercial' | 'standalone' | 'independent_home'
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    locality: text("locality").notNull(), // the micro-market unit; indexed
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    location: geography("location").notNull(), // property centre
    entryLocation: geography("entry_location").notNull(), // verified gate a driver navigates to (SRCH-08)
    outsiderPolicy: text("outsider_policy").notNull(), // 'allowed' | 'authorized_only' | 'disallowed'
    securityContacts: jsonb("security_contacts").$type<Array<{ name: string; phone: string; role: string }>>(),
    status: text("status").notNull().default("active"), // 'active' | 'archived'
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    locationGistIdx: index("properties_location_gist_idx").using("gist", table.location),
    entryLocationGistIdx: index("properties_entry_location_gist_idx").using("gist", table.entryLocation),
    localityIdx: index("properties_locality_idx").on(table.locality),
    createdByIdx: index("properties_created_by_idx").on(table.createdByUserId),
    propertyTypeCheck: check(
      "properties_property_type_check",
      sql`${table.propertyType} in ('society', 'commercial', 'standalone', 'independent_home')`
    ),
    outsiderPolicyCheck: check(
      "properties_outsider_policy_check",
      sql`${table.outsiderPolicy} in ('allowed', 'authorized_only', 'disallowed')`
    ),
    statusCheck: check("properties_status_check", sql`${table.status} in ('active', 'archived')`),
  })
);

export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;

export const propertyAuthorizations = pgTable(
  "property_authorizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    authorizedByUserId: uuid("authorized_by_user_id")
      .notNull()
      .references(() => users.id),
    authorizationType: text("authorization_type").notNull(), // 'owner_self' | 'society_resolution' | 'management_contract'
    permittedParkingTypes: jsonb("permitted_parking_types").$type<string[]>().notNull(), // ['hourly','daily']
    outsiderPolicy: text("outsider_policy").notNull(), // same domain as properties.outsider_policy
    documentId: uuid("document_id").references(() => hostDocuments.id),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // null = no expiry
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id"),
    revokeReason: text("revoke_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // "One live authorization per property" — `now()` isn't immutable so it
    // can't be part of the index predicate; expiry is re-checked at query
    // time instead (AC-4, §2.3's note on this exact index).
    liveAuthorizationUniqueIdx: uniqueIndex("property_authorizations_live_unique_idx")
      .on(table.propertyId)
      .where(sql`${table.revokedAt} is null`),
    propertyIdIdx: index("property_authorizations_property_id_idx").on(table.propertyId),
    authorizationTypeCheck: check(
      "property_authorizations_type_check",
      sql`${table.authorizationType} in ('owner_self', 'society_resolution', 'management_contract')`
    ),
    outsiderPolicyCheck: check(
      "property_authorizations_outsider_policy_check",
      sql`${table.outsiderPolicy} in ('allowed', 'authorized_only', 'disallowed')`
    ),
  })
);

export type PropertyAuthorization = typeof propertyAuthorizations.$inferSelect;
export type NewPropertyAuthorization = typeof propertyAuthorizations.$inferInsert;

export const propertyAccessPolicies = pgTable(
  "property_access_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    version: integer("version").notNull(),
    gateHours: jsonb("gate_hours")
      .$type<Array<{ dow: number; opens: string; closes: string }> | { always: true }>()
      .notNull(),
    accessMethods: jsonb("access_methods").$type<string[]>().notNull(), // ['qr','guard_manual','boom_barrier']
    escortRequired: boolean("escort_required").notNull().default(false),
    emergencyOverrideContact: jsonb("emergency_override_contact").$type<{ name: string; phone: string } | null>(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Append-only, versioned — never updated in place (AC-8).
    propertyVersionUniqueIdx: uniqueIndex("property_access_policies_property_version_idx").on(
      table.propertyId,
      table.version
    ),
  })
);

export type PropertyAccessPolicy = typeof propertyAccessPolicies.$inferSelect;
export type NewPropertyAccessPolicy = typeof propertyAccessPolicies.$inferInsert;

export const hostProfiles = pgTable(
  "host_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id),
    hostType: text("host_type").notNull(), // 'individual' | 'business'
    legalName: text("legal_name").notNull(),
    businessName: text("business_name"),
    gstin: text("gstin"),
    kycStatus: text("kyc_status").notNull().default("not_started"), // 'not_started'|'submitted'|'verified'|'rejected'
    kycReviewedBy: uuid("kyc_reviewed_by"),
    kycReviewedAt: timestamp("kyc_reviewed_at", { withTimezone: true }),
    kycRejectionReason: text("kyc_rejection_reason"),
    payoutAccountName: text("payout_account_name"),
    payoutBankName: text("payout_bank_name"),
    payoutIfsc: text("payout_ifsc"), // plaintext; identifies a branch, not an account
    payoutAccountLast4: text("payout_account_last4"), // plaintext, display only — this is what every API returns
    payoutAccountEnc: text("payout_account_enc"), // FULL account number, AES-256-GCM, base64(iv‖tag‖ciphertext)
    payoutKeyVersion: integer("payout_key_version"), // which key encrypted it — enables rotation without a flag day
    payoutAddedAt: timestamp("payout_added_at", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    hostTypeCheck: check("host_profiles_host_type_check", sql`${table.hostType} in ('individual', 'business')`),
    kycStatusCheck: check(
      "host_profiles_kyc_status_check",
      sql`${table.kycStatus} in ('not_started', 'submitted', 'verified', 'rejected')`
    ),
    statusCheck: check("host_profiles_status_check", sql`${table.status} in ('active', 'suspended')`),
  })
);

export type HostProfile = typeof hostProfiles.$inferSelect;
export type NewHostProfile = typeof hostProfiles.$inferInsert;

export const hostDocuments = pgTable(
  "host_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: text("owner_type").notNull(), // 'host_profile' | 'property'
    ownerId: uuid("owner_id").notNull(),
    docType: text("doc_type").notNull(), // 'pan'|'aadhaar'|'ownership_proof'|'authorization_letter'|'utility_bill'|'business_reg'
    storageKey: text("storage_key").notNull().unique(), // object key; bucket class is always private
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }), // set by the /complete call — presign alone doesn't mean the file exists
    reviewStatus: text("review_status").notNull().default("pending"), // 'pending'|'accepted'|'rejected'
    reviewedBy: uuid("reviewed_by"),
    rejectionReason: text("rejection_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }), // document validity, drives the INV-02 sweep
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("host_documents_owner_idx").on(table.ownerType, table.ownerId),
    ownerTypeCheck: check("host_documents_owner_type_check", sql`${table.ownerType} in ('host_profile', 'property')`),
    docTypeCheck: check(
      "host_documents_doc_type_check",
      sql`${table.docType} in ('pan', 'aadhaar', 'ownership_proof', 'authorization_letter', 'utility_bill', 'business_reg')`
    ),
    reviewStatusCheck: check(
      "host_documents_review_status_check",
      sql`${table.reviewStatus} in ('pending', 'accepted', 'rejected')`
    ),
  })
);

export type HostDocument = typeof hostDocuments.$inferSelect;
export type NewHostDocument = typeof hostDocuments.$inferInsert;

export const LISTING_STATUSES = [
  "draft",
  "pending_verification",
  "published",
  "paused",
  "suspended",
  "archived",
] as const;

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id),
    spaceLabel: text("space_label").notNull(), // "B2-14", "Gate 2, slot 3"
    spaceType: text("space_type").notNull(), // 'exclusive' | 'pool'
    capacity: integer("capacity").notNull().default(1),
    vehicleTypes: jsonb("vehicle_types").$type<string[]>(), // ['hatchback','sedan','suv'] — same domain as vehicles.type
    lengthCm: integer("length_cm"),
    widthCm: integer("width_cm"),
    heightCm: integer("height_cm"),
    covered: boolean("covered").notNull().default(false),
    amenities: jsonb("amenities").$type<{ evCharging?: boolean; cctv?: boolean; guarded?: boolean; open24x7?: boolean }>(),
    accessMethod: text("access_method"), // 'qr'|'guard_manual'|'open'
    rules: text("rules"),
    location: geography("location"), // nullable in draft; required to submit for publication
    status: text("status").notNull().default("draft"),
    statusReason: text("status_reason"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    locationGistIdx: index("listings_location_gist_idx").using("gist", table.location),
    propertyIdIdx: index("listings_property_id_idx").on(table.propertyId),
    hostUserIdIdx: index("listings_host_user_id_idx").on(table.hostUserId),
    // The hot path Sprint 3's search hits.
    publishedIdx: index("listings_published_idx").on(table.status).where(sql`${table.status} = 'published'`),
    spaceTypeCheck: check("listings_space_type_check", sql`${table.spaceType} in ('exclusive', 'pool')`),
    capacityCheck: check(
      "listings_capacity_check",
      sql`(${table.spaceType} = 'exclusive' and ${table.capacity} = 1) or (${table.spaceType} = 'pool' and ${table.capacity} > 1)`
    ),
    accessMethodCheck: check(
      "listings_access_method_check",
      sql`${table.accessMethod} in ('qr', 'guard_manual', 'open')`
    ),
    statusCheck: check("listings_status_check", sql`${table.status} in ('draft', 'pending_verification', 'published', 'paused', 'suspended', 'archived')`),
  })
);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;

export const listingPhotos = pgTable(
  "listing_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    storageKey: text("storage_key").notNull().unique(), // public-read bucket class
    position: integer("position").notNull(),
    isCover: boolean("is_cover").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Same mechanism as vehicles_user_id_default_unique_idx — the database is
    // the guarantee, not the application-level unset-then-set transaction.
    coverUniqueIdx: uniqueIndex("listing_photos_cover_unique_idx").on(table.listingId).where(sql`${table.isCover} = true`),
    listingIdIdx: index("listing_photos_listing_id_idx").on(table.listingId),
  })
);

export type ListingPhoto = typeof listingPhotos.$inferSelect;
export type NewListingPhoto = typeof listingPhotos.$inferInsert;

export const listingVerifications = pgTable(
  "listing_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    level: integer("level").notNull(), // 0..4
    method: text("method").notNull(), // 'self_declared'|'phone'|'photo_review'|'property_authorization'|'physical'
    evidenceDocumentId: uuid("evidence_document_id").references(() => hostDocuments.id),
    verifiedBy: uuid("verified_by"), // admin_users.id; null when system-derived
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => ({
    listingIdIdx: index("listing_verifications_listing_id_idx").on(table.listingId),
    levelCheck: check("listing_verifications_level_check", sql`${table.level} between 0 and 4`),
    methodCheck: check(
      "listing_verifications_method_check",
      sql`${table.method} in ('self_declared', 'phone', 'photo_review', 'property_authorization', 'physical')`
    ),
  })
);

export type ListingVerification = typeof listingVerifications.$inferSelect;
export type NewListingVerification = typeof listingVerifications.$inferInsert;

export const pricingVersions = pgTable(
  "pricing_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    version: integer("version").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Concurrent double-edit fails loudly, then the service retries with the
    // recomputed next version number (§2.5, R3).
    listingVersionUniqueIdx: uniqueIndex("pricing_versions_listing_version_idx").on(table.listingId, table.version),
  })
);

export type PricingVersion = typeof pricingVersions.$inferSelect;
export type NewPricingVersion = typeof pricingVersions.$inferInsert;

export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pricingVersionId: uuid("pricing_version_id")
      .notNull()
      .references(() => pricingVersions.id),
    ruleType: text("rule_type").notNull(), // 'base_hourly'|'base_daily'|'peak'|'weekend'
    amountPaise: integer("amount_paise").notNull(),
    daysOfWeek: jsonb("days_of_week").$type<number[] | null>(), // null = all
    windowStartMin: integer("window_start_min"), // minutes from midnight, null = all day
    windowEndMin: integer("window_end_min"),
    minDurationMin: integer("min_duration_min"),
  },
  (table) => ({
    pricingVersionIdIdx: index("pricing_rules_pricing_version_id_idx").on(table.pricingVersionId),
    ruleTypeCheck: check(
      "pricing_rules_rule_type_check",
      sql`${table.ruleType} in ('base_hourly', 'base_daily', 'peak', 'weekend')`
    ),
    amountCheck: check("pricing_rules_amount_check", sql`${table.amountPaise} >= 0`),
  })
);

export type PricingRule = typeof pricingRules.$inferSelect;
export type NewPricingRule = typeof pricingRules.$inferInsert;
