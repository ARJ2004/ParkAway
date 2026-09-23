import { and, count, eq, inArray } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { listingPhotos, listings, pricingVersions } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { isPropertyCurrentlyAuthorized, getPropertyOutsiderPolicy } from "../property/authorization.service.js";
import { requiredVerificationLevel, getEffectiveVerificationLevel } from "./verification.service.js";

export const MIN_SUBMIT_PHOTOS = 3;

/**
 * AC-5: only these transitions are legal; anything else is a 409 naming the
 * current state. `pending_verification`'s only legal exits are `published`
 * (admin approve) and `suspended` (admin reject/suspend) — there is no
 * `rejected` status in this schema (see modules/admin/moderation.service.ts
 * for how "reject" is represented within this set).
 */
export const LEGAL_TRANSITIONS: Record<string, string[]> = {
  draft: ["pending_verification", "archived"],
  pending_verification: ["published", "suspended"],
  published: ["paused", "suspended"],
  paused: ["published", "suspended", "archived"],
  suspended: ["archived"],
  archived: [],
};

/**
 * R2: every transition is a conditional `UPDATE ... WHERE id = $id AND
 * status = ANY(allowedFrom)`, never a SELECT-then-UPDATE. Zero rows
 * returned means the state changed under us — 409 naming what's there now.
 */
export async function conditionalTransition(
  db: Pick<Db, "select" | "update">,
  listingId: string,
  allowedFrom: string[],
  to: string,
  extra: { statusReason?: string | null; publishedAt?: Date | null } = {}
) {
  const [updated] = await db
    .update(listings)
    .set({
      status: to,
      statusReason: extra.statusReason ?? null,
      ...(extra.publishedAt !== undefined ? { publishedAt: extra.publishedAt } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(listings.id, listingId), inArray(listings.status, allowedFrom)))
    .returning();

  if (!updated) {
    const [current] = await db.select({ status: listings.status }).from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!current) throw new NotFoundError("Listing not found");
    throw new ConflictError("LISTING_STATE_CONFLICT", `Listing is currently '${current.status}'`);
  }
  return updated;
}

/**
 * AC-2: full validation runs, and every failing field is named at once, not
 * the first one.
 */
export async function submitForPublication(db: Db, userId: string, listingId: string) {
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing.hostUserId !== userId) throw new ForbiddenError("You do not own this listing");
  if (listing.status !== "draft") {
    throw new ConflictError("LISTING_STATE_CONFLICT", `Listing is currently '${listing.status}', not 'draft'`);
  }

  const failures: string[] = [];
  if (listing.location === null) failures.push("location");
  if (!listing.vehicleTypes || listing.vehicleTypes.length === 0) failures.push("vehicleTypes");
  if (listing.lengthCm === null || listing.widthCm === null || listing.heightCm === null) failures.push("dimensions");
  if (!listing.accessMethod) failures.push("accessMethod");

  const [photoCountRow] = await db.select({ photoCount: count() }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId));
  if (Number(photoCountRow?.photoCount ?? 0) < MIN_SUBMIT_PHOTOS) failures.push(`photos (at least ${MIN_SUBMIT_PHOTOS} required)`);

  const [pricingCountRow] = await db.select({ pricingCount: count() }).from(pricingVersions).where(eq(pricingVersions.listingId, listingId));
  if (Number(pricingCountRow?.pricingCount ?? 0) === 0) failures.push("pricing");

  const authState = await isPropertyCurrentlyAuthorized(db, listing.propertyId);
  const outsiderPolicy = await getPropertyOutsiderPolicy(db, listing.propertyId);
  if (!authState.authorized) failures.push(`property authorization (${authState.reason})`);
  if (outsiderPolicy === "disallowed") failures.push("property outsider policy (disallowed — this inventory can never be listed)"); // rule 9

  if (failures.length > 0) {
    throw new ValidationError("Listing is not ready for publication", { failures });
  }

  const updated = await conditionalTransition(db, listingId, ["draft"], "pending_verification");
  await recordAudit(db, { actorType: "driver", actorId: userId, action: "listing.submit", targetType: "listing", targetId: listingId });
  return updated;
}

async function assertHostOwnsAndInStates(db: Pick<Db, "select">, userId: string, listingId: string) {
  const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!listing) throw new NotFoundError("Listing not found");
  if (listing.hostUserId !== userId) throw new ForbiddenError("You do not own this listing");
  return listing;
}

export async function pauseListing(db: Db, userId: string, listingId: string) {
  await assertHostOwnsAndInStates(db, userId, listingId);
  const updated = await conditionalTransition(db, listingId, ["published"], "paused");
  await recordAudit(db, { actorType: "driver", actorId: userId, action: "listing.pause", targetType: "listing", targetId: listingId });
  return updated;
}

/**
 * Resuming re-exposes the listing to the marketplace, so it re-checks the
 * property's live authorization the same way `approveListing` does —
 * non-negotiable rule 9 must hold whenever a listing (re)enters `published`,
 * not only the first time.
 */
export async function resumeListing(db: Db, userId: string, listingId: string) {
  const listing = await assertHostOwnsAndInStates(db, userId, listingId);
  if (listing.status !== "paused") {
    throw new ConflictError("LISTING_STATE_CONFLICT", `Listing is currently '${listing.status}', not 'paused'`);
  }

  return db.transaction(async (tx) => {
    const authState = await isPropertyCurrentlyAuthorized(tx, listing.propertyId);
    if (!authState.authorized) {
      throw new ConflictError("PROPERTY_NOT_AUTHORIZED", `Cannot resume — property authorization is ${authState.reason}`);
    }
    const outsiderPolicy = await getPropertyOutsiderPolicy(tx, listing.propertyId);
    if (outsiderPolicy === "disallowed") {
      throw new ConflictError("PROPERTY_NOT_AUTHORIZED", "Cannot resume — this property does not allow marketplace listings");
    }

    const updated = await conditionalTransition(tx, listingId, ["paused"], "published", { publishedAt: new Date() });
    await recordAudit(tx, { actorType: "driver", actorId: userId, action: "listing.resume", targetType: "listing", targetId: listingId });
    return updated;
  });
}

export async function archiveListing(db: Db, userId: string, listingId: string) {
  await assertHostOwnsAndInStates(db, userId, listingId);
  const updated = await conditionalTransition(db, listingId, ["draft", "paused", "suspended"], "archived");
  await recordAudit(db, { actorType: "driver", actorId: userId, action: "listing.archive", targetType: "listing", targetId: listingId });
  return updated;
}

export { requiredVerificationLevel, getEffectiveVerificationLevel };
