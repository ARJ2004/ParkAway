import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { listings } from "../db/schema.js";
import { recordAudit } from "../lib/audit.js";
import { getEffectiveVerificationLevel, requiredVerificationLevel } from "../modules/listing/verification.service.js";

export interface SweepResult {
  checked: number;
  suspended: number;
}

/**
 * INV-02's daily sweep — the template every later job copies (§2.6). For
 * each `published` listing whose highest valid verification level has
 * fallen below its property's required minimum **as recomputed now** (not
 * as the job was scheduled), transitions to `suspended` with reason
 * `verification_expired` and a `system`-actor audit row.
 *
 * Idempotent by construction (rule 2 / R6): the `WHERE status = 'published'`
 * re-check inside the conditional UPDATE means a listing already suspended,
 * re-verified, or archived since scheduling is silently skipped — re-running
 * the sweep any number of times produces the same end state.
 */
export async function runVerificationExpirySweep(db: Db): Promise<SweepResult> {
  const publishedListings = await db.select({ id: listings.id, propertyId: listings.propertyId }).from(listings).where(eq(listings.status, "published"));

  let suspended = 0;
  for (const listing of publishedListings) {
    const [effectiveLevel, requiredLevel] = await Promise.all([
      getEffectiveVerificationLevel(db, listing.id),
      requiredVerificationLevel(db, listing.propertyId),
    ]);
    if (effectiveLevel >= requiredLevel) continue;

    const [updated] = await db
      .update(listings)
      .set({ status: "suspended", statusReason: "verification_expired", updatedAt: new Date() })
      .where(and(eq(listings.id, listing.id), eq(listings.status, "published")))
      .returning({ id: listings.id });

    if (updated) {
      suspended += 1;
      await recordAudit(db, {
        actorType: "system",
        actorId: null,
        action: "listing.verification.expire",
        targetType: "listing",
        targetId: listing.id,
        reason: "verification_expired",
      });
    }
  }

  return { checked: publishedListings.length, suspended };
}
