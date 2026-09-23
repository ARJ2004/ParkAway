import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { listings, properties, propertyAuthorizations } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { assertScoped } from "./property.service.js";

const AUTHORIZATION_TYPES = ["owner_self", "society_resolution", "management_contract"] as const;
const OUTSIDER_POLICIES = ["allowed", "authorized_only", "disallowed"] as const;

export interface GrantAuthorizationParams {
  authorizationType: string;
  permittedParkingTypes: string[];
  outsiderPolicy: string;
  effectiveFrom: string; // ISO
  expiresAt?: string | null; // ISO
  documentId?: string | null;
}

/**
 * §2.5 R1, grant half: takes the same row lock the revoke path takes,
 * before deciding whether a live authorization already exists. A second
 * grant while one is live supersedes it (revoked with reason
 * `superseded_by_new_grant`) rather than failing on the partial unique
 * index — "the authorization becomes the property's live authorization"
 * (AC-3) reads as replace, not reject.
 */
export async function grantAuthorization(db: Db, userId: string, propertyId: string, params: GrantAuthorizationParams, source: string | null) {
  await assertScoped(db, userId, propertyId);

  if (!AUTHORIZATION_TYPES.includes(params.authorizationType as (typeof AUTHORIZATION_TYPES)[number])) {
    throw new ValidationError(`authorizationType must be one of: ${AUTHORIZATION_TYPES.join(", ")}`);
  }
  if (!OUTSIDER_POLICIES.includes(params.outsiderPolicy as (typeof OUTSIDER_POLICIES)[number])) {
    throw new ValidationError(`outsiderPolicy must be one of: ${OUTSIDER_POLICIES.join(", ")}`);
  }
  if (!Array.isArray(params.permittedParkingTypes) || params.permittedParkingTypes.length === 0) {
    throw new ValidationError("permittedParkingTypes must be a non-empty array");
  }

  return db.transaction(async (tx) => {
    const [existingLive] = await tx
      .select()
      .from(propertyAuthorizations)
      .where(and(eq(propertyAuthorizations.propertyId, propertyId), isNull(propertyAuthorizations.revokedAt)))
      .for("update");

    if (existingLive) {
      await tx
        .update(propertyAuthorizations)
        .set({ revokedAt: new Date(), revokedByUserId: userId, revokeReason: "superseded_by_new_grant" })
        .where(eq(propertyAuthorizations.id, existingLive.id));
    }

    const [created] = await tx
      .insert(propertyAuthorizations)
      .values({
        propertyId,
        authorizedByUserId: userId,
        authorizationType: params.authorizationType,
        permittedParkingTypes: params.permittedParkingTypes,
        outsiderPolicy: params.outsiderPolicy,
        documentId: params.documentId ?? null,
        effectiveFrom: new Date(params.effectiveFrom),
        expiresAt: params.expiresAt ? new Date(params.expiresAt) : null,
      })
      .returning();
    if (!created) throw new Error("Authorization insert returned no row");

    await recordAudit(tx, {
      actorType: "driver",
      actorId: userId,
      action: "property.authorization.grant",
      targetType: "property",
      targetId: propertyId,
      source,
      metadata: { authorizationId: created.id, supersededPreviousId: existingLive?.id ?? null },
    });

    return created;
  });
}

/**
 * §2.5 R1, revoke half (the flagship race). Locks the live authorization
 * row first, then revokes, then cascades every `published` listing under
 * the property to `suspended` with reason `authorization_revoked` — all in
 * one transaction, so a concurrent publish attempt on the same property
 * either commits before this lock is taken (and gets caught by this
 * cascade) or blocks until this commits and then sees `revoked_at` already
 * set (and refuses to publish). Non-negotiable rule 9's structural
 * enforcement point.
 */
export async function revokeAuthorization(db: Db, userId: string, propertyId: string, authorizationId: string, reason: string, source: string | null) {
  await assertScoped(db, userId, propertyId);
  if (!reason || reason.trim().length === 0) {
    throw new ValidationError("reason is required");
  }

  return db.transaction(async (tx) => {
    const [live] = await tx
      .select()
      .from(propertyAuthorizations)
      .where(and(eq(propertyAuthorizations.propertyId, propertyId), isNull(propertyAuthorizations.revokedAt)))
      .for("update");

    if (!live || live.id !== authorizationId) {
      throw new NotFoundError("No live authorization with that id found for this property");
    }

    await tx
      .update(propertyAuthorizations)
      .set({ revokedAt: new Date(), revokedByUserId: userId, revokeReason: reason })
      .where(eq(propertyAuthorizations.id, live.id));

    const suspended = await tx
      .update(listings)
      .set({ status: "suspended", statusReason: "authorization_revoked", updatedAt: new Date() })
      .where(and(eq(listings.propertyId, propertyId), eq(listings.status, "published")))
      .returning({ id: listings.id });

    for (const listing of suspended) {
      await recordAudit(tx, {
        actorType: "driver",
        actorId: userId,
        action: "listing.suspend",
        targetType: "listing",
        targetId: listing.id,
        reason: "authorization_revoked",
        source,
      });
    }

    await recordAudit(tx, {
      actorType: "driver",
      actorId: userId,
      action: "property.authorization.revoke",
      targetType: "property",
      targetId: propertyId,
      reason,
      source,
      metadata: { authorizationId: live.id, suspendedListingCount: suspended.length },
    });

    return { suspendedListingCount: suspended.length };
  });
}

export async function getLatestAuthorization(db: Db, userId: string, propertyId: string, includeHistory: boolean) {
  await assertScoped(db, userId, propertyId);

  if (includeHistory) {
    return db.select().from(propertyAuthorizations).where(eq(propertyAuthorizations.propertyId, propertyId)).orderBy(propertyAuthorizations.createdAt);
  }

  const [live] = await db
    .select()
    .from(propertyAuthorizations)
    .where(and(eq(propertyAuthorizations.propertyId, propertyId), isNull(propertyAuthorizations.revokedAt)))
    .limit(1);
  return live ?? null;
}

/**
 * Query-time authorization check — never dependent on a job having run
 * (AC-4). Used by the listing publish path (§2.5 R1's other half, in
 * listing/lifecycle.service.ts) and by search in Sprint 3.
 */
export async function isPropertyCurrentlyAuthorized(
  tx: Pick<Db, "select">,
  propertyId: string
): Promise<{ authorized: boolean; reason?: "revoked_or_missing" | "expired" }> {
  const [live] = await tx
    .select()
    .from(propertyAuthorizations)
    .where(and(eq(propertyAuthorizations.propertyId, propertyId), isNull(propertyAuthorizations.revokedAt)))
    .limit(1);

  if (!live) return { authorized: false, reason: "revoked_or_missing" };
  if (live.expiresAt && live.expiresAt.getTime() <= Date.now()) return { authorized: false, reason: "expired" };
  return { authorized: true };
}

export async function getPropertyOutsiderPolicy(tx: Pick<Db, "select">, propertyId: string): Promise<string | null> {
  const [row] = await tx.select({ outsiderPolicy: properties.outsiderPolicy }).from(properties).where(eq(properties.id, propertyId)).limit(1);
  return row?.outsiderPolicy ?? null;
}
