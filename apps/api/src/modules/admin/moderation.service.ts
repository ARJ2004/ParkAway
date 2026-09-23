import { and, desc, eq, getTableColumns, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import {
  hostProfiles,
  listingPhotos,
  listingVerifications,
  listings,
  properties,
  propertyAuthorizations,
  pricingVersions,
  pricingRules,
} from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { selectLatLng } from "../../lib/geo.js";
import { conditionalTransition } from "../listing/lifecycle.service.js";
import { requiredVerificationLevel } from "../listing/verification.service.js";
import type { AdminRole } from "../auth/session.service.js";

const REJECT_REASONS = ["poor_photos", "incomplete_info", "location_mismatch", "duplicate_listing", "policy_violation", "other"] as const;
const SUSPEND_REASONS = ["authorization_issue", "complaint", "safety_concern", "fraud_suspected", "host_request", "other"] as const;
const MODERATION_STATUSES = ["pending_verification", "published", "suspended"] as const;

export interface ModerationQueueParams {
  status?: string;
  propertyId?: string;
  role: AdminRole;
}

/** `support` may view the queue with host PII masked (O-1). */
export async function listModerationQueue(db: Db, params: ModerationQueueParams) {
  const status = params.status && MODERATION_STATUSES.includes(params.status as (typeof MODERATION_STATUSES)[number]) ? params.status : "pending_verification";

  const rows = await db
    .select({
      id: listings.id,
      spaceLabel: listings.spaceLabel,
      status: listings.status,
      propertyId: listings.propertyId,
      hostUserId: listings.hostUserId,
      createdAt: listings.createdAt,
      hostLegalName: hostProfiles.legalName,
      hostKycStatus: hostProfiles.kycStatus,
    })
    .from(listings)
    .leftJoin(hostProfiles, eq(hostProfiles.userId, listings.hostUserId))
    .where(params.propertyId ? and(eq(listings.status, status), eq(listings.propertyId, params.propertyId)) : eq(listings.status, status))
    .orderBy(desc(listings.createdAt));

  if (params.role === "support") {
    return rows.map((row) => ({ ...row, hostLegalName: maskName(row.hostLegalName) }));
  }
  return rows;
}

function maskName(name: string | null): string | null {
  if (!name) return name;
  return name.length <= 2 ? "**" : `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}`;
}

/** Everything a moderator needs to judge a listing on one screen (AC-6). */
export async function getModerationDetail(db: Db, listingId: string, role: AdminRole) {
  const { location: _location, ...listingColumns } = getTableColumns(listings);
  const [listing] = await db
    .select({ ...listingColumns, ...selectLatLng(listings.location, "location") })
    .from(listings)
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!listing) throw new NotFoundError("Listing not found");

  const [property] = await db.select().from(properties).where(eq(properties.id, listing.propertyId)).limit(1);
  const [authorization] = await db
    .select()
    .from(propertyAuthorizations)
    .where(and(eq(propertyAuthorizations.propertyId, listing.propertyId), isNull(propertyAuthorizations.revokedAt)))
    .limit(1);
  const [hostProfile] = await db.select().from(hostProfiles).where(eq(hostProfiles.userId, listing.hostUserId)).limit(1);
  const photos = await db.select().from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).orderBy(listingPhotos.position);
  const verifications = await db.select().from(listingVerifications).where(eq(listingVerifications.listingId, listingId)).orderBy(desc(listingVerifications.verifiedAt));

  const [latestPricingVersion] = await db
    .select()
    .from(pricingVersions)
    .where(eq(pricingVersions.listingId, listingId))
    .orderBy(desc(pricingVersions.version))
    .limit(1);
  const pricing = latestPricingVersion ? await db.select().from(pricingRules).where(eq(pricingRules.pricingVersionId, latestPricingVersion.id)) : [];

  const requiredLevel = await requiredVerificationLevel(db, listing.propertyId);

  const hostSummary =
    role === "support" && hostProfile
      ? { legalName: maskName(hostProfile.legalName), kycStatus: hostProfile.kycStatus, hostType: hostProfile.hostType }
      : hostProfile
        ? { legalName: hostProfile.legalName, kycStatus: hostProfile.kycStatus, hostType: hostProfile.hostType, id: hostProfile.id }
        : null;

  return { listing, property, authorization: authorization ?? null, host: hostSummary, photos, verifications, pricing, requiredLevel };
}

export interface ApproveListingParams {
  level: number;
  expiresAt?: string;
  reasonCategory: string;
  note?: string;
}

/**
 * §2.5 R1, publish half: locks the property's live authorization row inside
 * this same transaction, before transitioning the listing — whichever of
 * this and a concurrent revoke gets the lock first wins; the loser sees
 * committed state and does the right thing (never a `published` listing
 * under a revoked authorization). `platform_admin`-only, enforced at the
 * route level.
 */
export async function approveListing(db: Db, adminId: string, listingId: string, params: ApproveListingParams, source: string | null) {
  if (!Number.isInteger(params.level) || params.level < 0 || params.level > 4) {
    throw new ValidationError("level must be an integer between 0 and 4");
  }
  if (!params.reasonCategory) {
    throw new ValidationError("reasonCategory is required");
  }

  return db.transaction(async (tx) => {
    const [listing] = await tx.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing) throw new NotFoundError("Listing not found");
    if (listing.status !== "pending_verification") {
      throw new ConflictError("LISTING_STATE_CONFLICT", `Listing is currently '${listing.status}', not 'pending_verification'`);
    }

    const requiredLevel = await requiredVerificationLevel(tx, listing.propertyId);
    if (params.level < requiredLevel) {
      throw new ValidationError(`This property requires verification level ${requiredLevel}+ to publish (AC-3)`);
    }

    // R1 lock — taken before deciding whether to publish.
    const [auth] = await tx
      .select()
      .from(propertyAuthorizations)
      .where(and(eq(propertyAuthorizations.propertyId, listing.propertyId), isNull(propertyAuthorizations.revokedAt)))
      .for("update");
    const authValid = Boolean(auth) && (!auth!.expiresAt || auth!.expiresAt.getTime() > Date.now());
    if (!authValid) {
      throw new ConflictError("PROPERTY_NOT_AUTHORIZED", auth ? "expired" : "revoked_or_missing");
    }

    const [property] = await tx.select({ outsiderPolicy: properties.outsiderPolicy }).from(properties).where(eq(properties.id, listing.propertyId)).limit(1);
    if (property?.outsiderPolicy === "disallowed") {
      throw new ConflictError("PROPERTY_NOT_AUTHORIZED", "outsiders_disallowed");
    }

    const updated = await conditionalTransition(tx, listingId, ["pending_verification"], "published", { publishedAt: new Date() });

    await tx.insert(listingVerifications).values({
      listingId,
      level: params.level,
      method: params.level >= 3 ? "property_authorization" : "photo_review",
      verifiedBy: adminId,
      expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
    });

    await recordAudit(tx, {
      actorType: "admin",
      actorId: adminId,
      action: "listing.approve",
      targetType: "listing",
      targetId: listingId,
      reason: params.reasonCategory,
      source,
      metadata: { level: params.level, note: params.note ?? null },
    });

    return updated;
  });
}

/**
 * There is no `rejected` listing status in this schema — rejection is
 * represented as `suspended` with `status_reason` set to the reason
 * category, and a distinct `listing.reject` audit action preserves the
 * moderator's actual intent for anyone reading the trail later.
 */
export async function rejectListing(db: Db, adminId: string, listingId: string, reasonCategory: string, note: string | undefined, source: string | null) {
  if (!REJECT_REASONS.includes(reasonCategory as (typeof REJECT_REASONS)[number])) {
    throw new ValidationError(`reasonCategory must be one of: ${REJECT_REASONS.join(", ")}`);
  }
  const updated = await conditionalTransition(db, listingId, ["pending_verification"], "suspended", { statusReason: reasonCategory });
  await recordAudit(db, {
    actorType: "admin",
    actorId: adminId,
    action: "listing.reject",
    targetType: "listing",
    targetId: listingId,
    reason: reasonCategory,
    source,
    metadata: { note: note ?? null },
  });
  return updated;
}

export async function suspendListing(db: Db, adminId: string, listingId: string, reasonCategory: string, note: string | undefined, source: string | null) {
  if (!SUSPEND_REASONS.includes(reasonCategory as (typeof SUSPEND_REASONS)[number])) {
    throw new ValidationError(`reasonCategory must be one of: ${SUSPEND_REASONS.join(", ")}`);
  }
  const updated = await conditionalTransition(db, listingId, ["pending_verification", "published", "paused"], "suspended", { statusReason: reasonCategory });
  await recordAudit(db, {
    actorType: "admin",
    actorId: adminId,
    action: "listing.suspend",
    targetType: "listing",
    targetId: listingId,
    reason: reasonCategory,
    source,
    metadata: { note: note ?? null },
  });
  return updated;
}
