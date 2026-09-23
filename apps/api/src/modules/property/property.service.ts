import { and, eq, getTableColumns, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { properties, propertyAuthorizations, userRoles } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { geoPoint, isValidLatLng, selectLatLng, type LatLng } from "../../lib/geo.js";

const PROPERTY_TYPES = ["society", "commercial", "standalone", "independent_home"] as const;
const OUTSIDER_POLICIES = ["allowed", "authorized_only", "disallowed"] as const;
const SELF_AUTHORIZING_TYPES = new Set(["independent_home", "standalone"]);

export interface CreatePropertyParams {
  name: string;
  propertyType: string;
  addressLine1: string;
  addressLine2?: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  location: LatLng;
  entryLocation: LatLng;
  outsiderPolicy: string;
  securityContacts?: Array<{ name: string; phone: string; role: string }>;
}

function assertValidPropertyShape(params: CreatePropertyParams) {
  if (!PROPERTY_TYPES.includes(params.propertyType as (typeof PROPERTY_TYPES)[number])) {
    throw new ValidationError(`propertyType must be one of: ${PROPERTY_TYPES.join(", ")}`);
  }
  if (!OUTSIDER_POLICIES.includes(params.outsiderPolicy as (typeof OUTSIDER_POLICIES)[number])) {
    throw new ValidationError(`outsiderPolicy must be one of: ${OUTSIDER_POLICIES.join(", ")}`);
  }
  // AC-2: a property with no trustworthy coordinates cannot exist — SRCH-04/
  // SRCH-08 depend on entry coordinates being real rather than geocoded
  // approximations.
  if (!isValidLatLng(params.location)) {
    throw new ValidationError("location must be a valid { lat, lng } pair");
  }
  if (!isValidLatLng(params.entryLocation)) {
    throw new ValidationError("entryLocation must be a valid { lat, lng } pair");
  }
}

/**
 * Grants `property_manager` (scoped to the new property) to the creator.
 * For `independent_home`/`standalone`, also inserts the `owner_self`
 * authorization in the same transaction (locked decision 4) — the owner
 * never sees the word "authorization" for their own driveway, but the row
 * exists so the publication guard, revocation cascade and query-time expiry
 * check all work identically for an individual owner and a 400-flat society.
 */
export async function createProperty(db: Db, userId: string, params: CreatePropertyParams) {
  assertValidPropertyShape(params);

  return db.transaction(async (tx) => {
    const [property] = await tx
      .insert(properties)
      .values({
        name: params.name,
        propertyType: params.propertyType,
        addressLine1: params.addressLine1,
        addressLine2: params.addressLine2 ?? null,
        locality: params.locality,
        city: params.city,
        state: params.state,
        pincode: params.pincode,
        location: geoPoint(params.location),
        entryLocation: geoPoint(params.entryLocation),
        outsiderPolicy: params.outsiderPolicy,
        securityContacts: params.securityContacts ?? null,
        createdByUserId: userId,
      })
      .returning();
    if (!property) throw new Error("Property insert returned no row");

    await tx.insert(userRoles).values({
      userId,
      role: "property_manager",
      scopeType: "property",
      scopeId: property.id,
      grantedByType: "self",
      grantedByUserId: null,
    });

    if (SELF_AUTHORIZING_TYPES.has(params.propertyType)) {
      await tx.insert(propertyAuthorizations).values({
        propertyId: property.id,
        authorizedByUserId: userId,
        authorizationType: "owner_self",
        permittedParkingTypes: ["hourly", "daily"],
        outsiderPolicy: params.outsiderPolicy,
        effectiveFrom: new Date(),
        expiresAt: null,
      });
    }

    await recordAudit(tx, {
      actorType: "driver",
      actorId: userId,
      action: "property.create",
      targetType: "property",
      targetId: property.id,
      metadata: { propertyType: params.propertyType, selfAuthorized: SELF_AUTHORIZING_TYPES.has(params.propertyType) },
    });

    // `.returning()` on a geography column comes back as opaque EWKB hex —
    // an internal wire representation, never fit for an API response.
    // Substituting the input coordinates avoids a second round-trip through
    // ST_X/ST_Y for the value we already validated and inserted.
    const { location: _location, entryLocation: _entryLocation, ...rest } = property;
    return { ...rest, location: params.location, entryLocation: params.entryLocation };
  });
}

/** Scoped to the caller's `user_roles` grants — never a global list. */
export async function listProperties(db: Db, userId: string) {
  const scoped = await db
    .select({ propertyId: userRoles.scopeId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "property_manager"), isNull(userRoles.revokedAt)));

  if (scoped.length === 0) return [];

  const ids = scoped.map((row) => row.propertyId).filter((id): id is string => id !== null);
  const rows = await db.select({ ...columnsWithoutGeo() }).from(properties);
  return rows.filter((row) => ids.includes(row.id));
}

/** `getTableColumns()` minus the two geography columns — those come back as opaque EWKB hex and are never fit for an API response as-is (see selectLatLng() usage in getProperty()). */
function columnsWithoutGeo() {
  const { location: _location, entryLocation: _entryLocation, ...rest } = getTableColumns(properties);
  return rest;
}

export async function getProperty(db: Db, userId: string, propertyId: string) {
  await assertScoped(db, userId, propertyId);
  const [row] = await db
    .select({
      ...columnsWithoutGeo(),
      ...selectLatLng(properties.location, "location"),
      ...selectLatLng(properties.entryLocation, "entryLocation"),
    })
    .from(properties)
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!row) throw new NotFoundError("Property not found");
  return row;
}

export interface UpdatePropertyParams {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  outsiderPolicy?: string;
  securityContacts?: Array<{ name: string; phone: string; role: string }>;
}

export async function updateProperty(db: Db, userId: string, propertyId: string, patch: UpdatePropertyParams) {
  await assertScoped(db, userId, propertyId);
  if (patch.outsiderPolicy && !OUTSIDER_POLICIES.includes(patch.outsiderPolicy as (typeof OUTSIDER_POLICIES)[number])) {
    throw new ValidationError(`outsiderPolicy must be one of: ${OUTSIDER_POLICIES.join(", ")}`);
  }

  const [updated] = await db
    .update(properties)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.addressLine1 !== undefined ? { addressLine1: patch.addressLine1 } : {}),
      ...(patch.addressLine2 !== undefined ? { addressLine2: patch.addressLine2 } : {}),
      ...(patch.outsiderPolicy !== undefined ? { outsiderPolicy: patch.outsiderPolicy } : {}),
      ...(patch.securityContacts !== undefined ? { securityContacts: patch.securityContacts } : {}),
      updatedAt: new Date(),
    })
    .where(eq(properties.id, propertyId))
    .returning();
  if (!updated) throw new NotFoundError("Property not found");

  await recordAudit(db, {
    actorType: "driver",
    actorId: userId,
    action: "property.update",
    targetType: "property",
    targetId: propertyId,
  });

  // `updated` still carries the two geography columns as opaque EWKB hex
  // (this patch never touches them) — re-read through getProperty() rather
  // than return them raw.
  return getProperty(db, userId, propertyId);
}

/**
 * 403 (not 404) when out of scope, per AC-10 — a property manager acting on
 * a property they aren't scoped to should never receive an answer shaped
 * like "no such property".
 */
export async function assertScoped(db: Pick<Db, "select">, userId: string, propertyId: string): Promise<void> {
  const [grant] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.role, "property_manager"),
        eq(userRoles.scopeType, "property"),
        eq(userRoles.scopeId, propertyId),
        isNull(userRoles.revokedAt)
      )
    )
    .limit(1);
  if (!grant) throw new ForbiddenError("You are not scoped to manage this property");
}
