import { desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { propertyAccessPolicies } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ValidationError } from "../../lib/errors.js";
import { assertScoped } from "./property.service.js";

export interface AccessPolicyParams {
  gateHours: Array<{ dow: number; opens: string; closes: string }> | { always: true };
  accessMethods: string[];
  escortRequired?: boolean;
  emergencyOverrideContact?: { name: string; phone: string } | null;
  effectiveFrom: string; // ISO
}

/** Never a PUT — versions are immutable, a new row is appended every time (AC-8). */
export async function addAccessPolicyVersion(db: Db, userId: string, propertyId: string, params: AccessPolicyParams, source: string | null) {
  await assertScoped(db, userId, propertyId);
  if (!Array.isArray(params.accessMethods) || params.accessMethods.length === 0) {
    throw new ValidationError("accessMethods must be a non-empty array");
  }

  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: propertyAccessPolicies.version })
      .from(propertyAccessPolicies)
      .where(eq(propertyAccessPolicies.propertyId, propertyId))
      .orderBy(desc(propertyAccessPolicies.version))
      .limit(1);

    const [created] = await tx
      .insert(propertyAccessPolicies)
      .values({
        propertyId,
        version: (latest?.version ?? 0) + 1,
        gateHours: params.gateHours,
        accessMethods: params.accessMethods,
        escortRequired: params.escortRequired ?? false,
        emergencyOverrideContact: params.emergencyOverrideContact ?? null,
        effectiveFrom: new Date(params.effectiveFrom),
        createdByUserId: userId,
      })
      .returning();
    if (!created) throw new Error("Access policy insert returned no row");

    await recordAudit(tx, {
      actorType: "driver",
      actorId: userId,
      action: "property.access_policy.version",
      targetType: "property",
      targetId: propertyId,
      source,
      metadata: { version: created.version },
    });

    return created;
  });
}

export async function getAccessPolicy(db: Db, userId: string, propertyId: string, includeHistory: boolean) {
  await assertScoped(db, userId, propertyId);

  if (includeHistory) {
    return db.select().from(propertyAccessPolicies).where(eq(propertyAccessPolicies.propertyId, propertyId)).orderBy(desc(propertyAccessPolicies.version));
  }

  const [latest] = await db
    .select()
    .from(propertyAccessPolicies)
    .where(eq(propertyAccessPolicies.propertyId, propertyId))
    .orderBy(desc(propertyAccessPolicies.version))
    .limit(1);
  return latest ?? null;
}
