import { desc, eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { pricingRules, pricingVersions } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ValidationError } from "../../lib/errors.js";
import { isUniqueViolation, pgConstraintName } from "../../lib/pgErrors.js";
import { assertOwnsListing } from "../listing/listing.service.js";
import { resolvePrice, type PriceBreakdown, type PricingRuleInput } from "./resolve.js";

const RULE_TYPES = ["base_hourly", "base_daily", "peak", "weekend"] as const;
const PRICING_VERSION_UNIQUE_CONSTRAINT = "pricing_versions_listing_version_idx";
const MAX_VERSION_RETRIES = 3;

export interface SetPricingParams {
  effectiveFrom?: string; // ISO; defaults to now
  rules: Array<{
    ruleType: string;
    amountPaise: number;
    daysOfWeek?: number[];
    windowStartMin?: number;
    windowEndMin?: number;
    minDurationMin?: number;
  }>;
}

function validateRules(rules: SetPricingParams["rules"]) {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new ValidationError("rules must be a non-empty array");
  }
  for (const rule of rules) {
    if (!RULE_TYPES.includes(rule.ruleType as (typeof RULE_TYPES)[number])) {
      throw new ValidationError(`ruleType must be one of: ${RULE_TYPES.join(", ")}`);
    }
    if (!Number.isInteger(rule.amountPaise) || rule.amountPaise < 0) {
      throw new ValidationError("amountPaise must be a non-negative integer (paise)");
    }
  }
  const hasBase = rules.some((r) => r.ruleType === "base_hourly" || r.ruleType === "base_daily");
  if (!hasBase) {
    throw new ValidationError("At least one base_hourly or base_daily rule is required");
  }
}

/**
 * Appends a new immutable pricing version — the previous version is
 * retained and stays the effective version for any time window before the
 * new one takes effect (AC-1). R3: `unique(listing_id, version)` means a
 * concurrent double-edit fails loudly on the losing writer, which retries
 * with the recomputed next version — same retry shape `updateVehicle`
 * already uses for the default-vehicle race.
 */
export async function setPricing(db: Db, userId: string, listingId: string, params: SetPricingParams) {
  await assertOwnsListing(db, userId, listingId);
  validateRules(params.rules);

  for (let attempt = 1; attempt <= MAX_VERSION_RETRIES; attempt++) {
    try {
      return await attemptInsertVersion(db, userId, listingId, params);
    } catch (err) {
      const isVersionRace = isUniqueViolation(err) && pgConstraintName(err) === PRICING_VERSION_UNIQUE_CONSTRAINT;
      if (!isVersionRace || attempt === MAX_VERSION_RETRIES) throw err;
    }
  }
  throw new Error("unreachable");
}

async function attemptInsertVersion(db: Db, userId: string, listingId: string, params: SetPricingParams) {
  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select({ version: pricingVersions.version })
      .from(pricingVersions)
      .where(eq(pricingVersions.listingId, listingId))
      .orderBy(desc(pricingVersions.version))
      .limit(1);
    const nextVersion = (latest?.version ?? 0) + 1;

    const [version] = await tx
      .insert(pricingVersions)
      .values({
        listingId,
        version: nextVersion,
        effectiveFrom: params.effectiveFrom ? new Date(params.effectiveFrom) : new Date(),
        createdByUserId: userId,
      })
      .returning();
    if (!version) throw new Error("Pricing version insert returned no row");

    const insertedRules = await tx
      .insert(pricingRules)
      .values(
        params.rules.map((rule) => ({
          pricingVersionId: version.id,
          ruleType: rule.ruleType,
          amountPaise: rule.amountPaise,
          daysOfWeek: rule.daysOfWeek ?? null,
          windowStartMin: rule.windowStartMin ?? null,
          windowEndMin: rule.windowEndMin ?? null,
          minDurationMin: rule.minDurationMin ?? null,
        }))
      )
      .returning();

    await recordAudit(tx, {
      actorType: "driver",
      actorId: userId,
      action: "listing.pricing.version",
      targetType: "listing",
      targetId: listingId,
      metadata: { version: nextVersion },
    });

    return { ...version, rules: insertedRules };
  });
}

async function getLatestVersionRules(db: Pick<Db, "select">, listingId: string): Promise<PricingRuleInput[] | null> {
  const [latest] = await db
    .select({ id: pricingVersions.id })
    .from(pricingVersions)
    .where(eq(pricingVersions.listingId, listingId))
    .orderBy(desc(pricingVersions.version))
    .limit(1);
  if (!latest) return null;

  const rows = await db.select().from(pricingRules).where(eq(pricingRules.pricingVersionId, latest.id));
  // ruleType is CHECK-constrained at the DB level to the same domain as
  // PricingRuleInput["ruleType"] — asserted here rather than re-validated,
  // same convention as session.service.ts's `role as AdminRole`.
  return rows.map((r) => ({
    ruleType: r.ruleType as PricingRuleInput["ruleType"],
    amountPaise: r.amountPaise,
    daysOfWeek: r.daysOfWeek,
    windowStartMin: r.windowStartMin,
    windowEndMin: r.windowEndMin,
    minDurationMin: r.minDurationMin,
  }));
}

/**
 * Returns the same breakdown structure Sprint 4's checkout will use — one
 * calculator, not two (AC-4).
 */
export async function previewPrice(db: Db, userId: string, listingId: string, startIso: string, endIso: string): Promise<PriceBreakdown> {
  await assertOwnsListing(db, userId, listingId);
  if (!startIso || !endIso) throw new ValidationError("start and end query params are required");

  const rules = await getLatestVersionRules(db, listingId);
  if (!rules || rules.length === 0) throw new ValidationError("No pricing has been set for this listing yet");

  return resolvePrice(rules, new Date(startIso), new Date(endIso));
}

export { resolvePrice } from "./resolve.js";
export type { PriceBreakdown, PricingRuleInput } from "./resolve.js";
