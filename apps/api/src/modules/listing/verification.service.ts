import { and, eq, isNull, or, gt } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { listingVerifications, properties } from "../../db/schema.js";

/**
 * The badge is derived from the highest currently-valid (unexpired,
 * unrevoked) verification record — never a mutable column someone can set
 * directly (AC-2).
 */
export async function getEffectiveVerificationLevel(db: Pick<Db, "select">, listingId: string): Promise<number> {
  const now = new Date();
  const rows = await db
    .select({ level: listingVerifications.level })
    .from(listingVerifications)
    .where(
      and(
        eq(listingVerifications.listingId, listingId),
        isNull(listingVerifications.revokedAt),
        or(isNull(listingVerifications.expiresAt), gt(listingVerifications.expiresAt, now))
      )
    );
  return rows.reduce((max, row) => Math.max(max, row.level), 0);
}

/** AC-3: level 3 (property authorization) is required inside `society`/`commercial` properties; level 2 elsewhere (O-2). */
export async function requiredVerificationLevel(db: Pick<Db, "select">, propertyId: string): Promise<number> {
  const [property] = await db.select({ propertyType: properties.propertyType }).from(properties).where(eq(properties.id, propertyId)).limit(1);
  const gated = property?.propertyType === "society" || property?.propertyType === "commercial";
  return gated ? 3 : 2;
}
