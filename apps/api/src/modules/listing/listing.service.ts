import { and, desc, eq, getTableColumns } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { listings } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { geoPoint, isValidLatLng, selectLatLng, type LatLng } from "../../lib/geo.js";

const SPACE_TYPES = ["exclusive", "pool"] as const;
const ACCESS_METHODS = ["qr", "guard_manual", "open"] as const;

export interface CreateListingParams {
  propertyId: string;
  spaceLabel: string;
  spaceType?: string;
  capacity?: number;
}

/** AC-1: created as `draft`, editable without any validation beyond "it has a name". */
export async function createListing(db: Db, userId: string, params: CreateListingParams) {
  if (!params.propertyId) throw new ValidationError("propertyId is required");
  if (!params.spaceLabel?.trim()) throw new ValidationError("spaceLabel is required");

  const spaceType = params.spaceType ?? "exclusive";
  if (!SPACE_TYPES.includes(spaceType as (typeof SPACE_TYPES)[number])) {
    throw new ValidationError(`spaceType must be one of: ${SPACE_TYPES.join(", ")}`);
  }
  const capacity = params.capacity ?? (spaceType === "exclusive" ? 1 : 2);
  if (spaceType === "exclusive" && capacity !== 1) throw new ValidationError("capacity must be 1 for an exclusive space");
  if (spaceType === "pool" && capacity <= 1) throw new ValidationError("capacity must be greater than 1 for a pool space");

  const [created] = await db
    .insert(listings)
    .values({ propertyId: params.propertyId, hostUserId: userId, spaceLabel: params.spaceLabel, spaceType, capacity })
    .returning();
  if (!created) throw new Error("Listing insert returned no row");

  await recordAudit(db, { actorType: "driver", actorId: userId, action: "listing.create", targetType: "listing", targetId: created.id });
  return created;
}

/** `getTableColumns()` minus `location` — that column comes back as opaque EWKB hex over the wire and is never fit for an API response as-is. */
function columnsWithoutGeo() {
  const { location: _location, ...rest } = getTableColumns(listings);
  return rest;
}

export async function listOwnListings(db: Db, userId: string) {
  return db.select({ ...columnsWithoutGeo() }).from(listings).where(eq(listings.hostUserId, userId)).orderBy(desc(listings.createdAt));
}

export async function getOwnListing(db: Db, userId: string, listingId: string) {
  const [row] = await db
    .select({ ...columnsWithoutGeo(), ...selectLatLng(listings.location, "location") })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!row) throw new NotFoundError("Listing not found");
  if (row.hostUserId !== userId) throw new ForbiddenError("You do not own this listing"); // AC-9
  return row;
}

export interface UpdateListingParams {
  spaceLabel?: string;
  vehicleTypes?: string[];
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  covered?: boolean;
  amenities?: { evCharging?: boolean; cctv?: boolean; guarded?: boolean; open24x7?: boolean };
  accessMethod?: string;
  rules?: string;
  location?: LatLng;
}

const NOT_EDITABLE_STATUSES = new Set(["pending_verification", "suspended"]);

export async function updateListing(db: Db, userId: string, listingId: string, patch: UpdateListingParams) {
  const [existing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!existing) throw new NotFoundError("Listing not found");
  if (existing.hostUserId !== userId) throw new ForbiddenError("You do not own this listing");
  if (NOT_EDITABLE_STATUSES.has(existing.status)) {
    throw new ForbiddenError(`Listing cannot be edited while in status '${existing.status}'`);
  }
  if (patch.accessMethod && !ACCESS_METHODS.includes(patch.accessMethod as (typeof ACCESS_METHODS)[number])) {
    throw new ValidationError(`accessMethod must be one of: ${ACCESS_METHODS.join(", ")}`);
  }
  if (patch.location && !isValidLatLng(patch.location)) {
    throw new ValidationError("location must be a valid { lat, lng } pair");
  }

  const [updated] = await db
    .update(listings)
    .set({
      ...(patch.spaceLabel !== undefined ? { spaceLabel: patch.spaceLabel } : {}),
      ...(patch.vehicleTypes !== undefined ? { vehicleTypes: patch.vehicleTypes } : {}),
      ...(patch.lengthCm !== undefined ? { lengthCm: patch.lengthCm } : {}),
      ...(patch.widthCm !== undefined ? { widthCm: patch.widthCm } : {}),
      ...(patch.heightCm !== undefined ? { heightCm: patch.heightCm } : {}),
      ...(patch.covered !== undefined ? { covered: patch.covered } : {}),
      ...(patch.amenities !== undefined ? { amenities: patch.amenities } : {}),
      ...(patch.accessMethod !== undefined ? { accessMethod: patch.accessMethod } : {}),
      ...(patch.rules !== undefined ? { rules: patch.rules } : {}),
      ...(patch.location !== undefined ? { location: geoPoint(patch.location) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId))
    .returning();
  if (!updated) throw new NotFoundError("Listing not found");
  // `updated` still carries `location` as opaque EWKB hex when it wasn't
  // part of this patch — re-read through getOwnListing() rather than
  // return it raw either way.
  return getOwnListing(db, userId, listingId);
}

export async function assertOwnsListing(db: Pick<Db, "select">, userId: string, listingId: string) {
  const [row] = await db.select({ id: listings.id }).from(listings).where(and(eq(listings.id, listingId), eq(listings.hostUserId, userId))).limit(1);
  if (!row) throw new ForbiddenError("You do not own this listing");
}
