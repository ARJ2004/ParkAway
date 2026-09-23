import { eq, and } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { hostProfiles, userRoles } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { encryptField } from "../../lib/fieldCrypto.js";
import { isUniqueViolation } from "../../lib/pgErrors.js";

const HOST_TYPES = ["individual", "business"] as const;
// 4 letters + '0' + 6 alphanumeric (AC-10).
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_RE = /^\d{9,18}$/;

export interface CreateHostProfileParams {
  hostType: string;
  legalName: string;
  businessName?: string;
  gstin?: string;
}

/** Never returns `payoutAccountEnc` — every host profile response is last4-only (AC-7). */
function toPublicProfile<T extends { payoutAccountEnc: string | null; payoutKeyVersion: number | null }>(row: T) {
  const { payoutAccountEnc: _enc, payoutKeyVersion: _v, ...rest } = row;
  return rest;
}

export async function createHostProfile(db: Db, userId: string, params: CreateHostProfileParams) {
  if (!HOST_TYPES.includes(params.hostType as (typeof HOST_TYPES)[number])) {
    throw new ValidationError(`hostType must be one of: ${HOST_TYPES.join(", ")}`);
  }
  if (!params.legalName?.trim()) {
    throw new ValidationError("legalName is required");
  }

  return db.transaction(async (tx) => {
    let created;
    try {
      [created] = await tx
        .insert(hostProfiles)
        .values({
          userId,
          hostType: params.hostType,
          legalName: params.legalName,
          businessName: params.businessName ?? null,
          gstin: params.gstin ?? null,
        })
        .returning();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError("HOST_PROFILE_EXISTS", "A host profile already exists for this account");
      }
      throw err;
    }
    if (!created) throw new Error("Host profile insert returned no row");

    try {
      // Nested `tx.transaction()` = a real SAVEPOINT — a unique-violation
      // here must not abort the outer transaction, since `recordAudit(tx, ...)`
      // below still needs to run on it regardless of which branch this hits
      // (see the identical fix + comment in identity/persona.service.ts,
      // where this exact class of bug was first caught).
      await tx.transaction(async (tx2) => {
        await tx2.insert(userRoles).values({ userId, role: "host", scopeType: null, scopeId: null, grantedByType: "self", grantedByUserId: null });
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err; // already granted — fine
    }

    await recordAudit(tx, {
      actorType: "driver",
      actorId: userId,
      action: "host.profile.create",
      targetType: "host_profile",
      targetId: created.id,
      metadata: { hostType: params.hostType },
    });

    return toPublicProfile(created);
  });
}

export async function getOwnHostProfile(db: Db, userId: string) {
  const [row] = await db.select().from(hostProfiles).where(eq(hostProfiles.userId, userId)).limit(1);
  if (!row) throw new NotFoundError("Host profile not found");
  return toPublicProfile(row);
}

/** Resolves a caller's host_profiles.id — used to authorize document/listing ownership checks. */
export async function getOwnHostProfileId(db: Pick<Db, "select">, userId: string): Promise<string | null> {
  const [row] = await db.select({ id: hostProfiles.id }).from(hostProfiles).where(eq(hostProfiles.userId, userId)).limit(1);
  return row?.id ?? null;
}

export interface UpdateHostProfileParams {
  legalName?: string;
  businessName?: string;
  gstin?: string;
}

export async function updateHostProfile(db: Db, userId: string, patch: UpdateHostProfileParams) {
  const [updated] = await db
    .update(hostProfiles)
    .set({
      ...(patch.legalName !== undefined ? { legalName: patch.legalName } : {}),
      ...(patch.businessName !== undefined ? { businessName: patch.businessName } : {}),
      ...(patch.gstin !== undefined ? { gstin: patch.gstin } : {}),
      updatedAt: new Date(),
    })
    .where(eq(hostProfiles.userId, userId))
    .returning();
  if (!updated) throw new NotFoundError("Host profile not found");
  return toPublicProfile(updated);
}

/** `not_started`/`rejected` → `submitted` (AC-3). */
export async function submitKyc(db: Db, userId: string) {
  const [existing] = await db.select({ id: hostProfiles.id, kycStatus: hostProfiles.kycStatus }).from(hostProfiles).where(eq(hostProfiles.userId, userId)).limit(1);
  if (!existing) throw new NotFoundError("Host profile not found");
  if (existing.kycStatus === "verified" || existing.kycStatus === "submitted") {
    throw new ConflictError("KYC_ALREADY_SUBMITTED", `KYC is currently '${existing.kycStatus}' and cannot be resubmitted`);
  }

  const [updated] = await db
    .update(hostProfiles)
    .set({ kycStatus: "submitted", kycRejectionReason: null, updatedAt: new Date() })
    .where(eq(hostProfiles.userId, userId))
    .returning();
  if (!updated) throw new NotFoundError("Host profile not found");

  await recordAudit(db, { actorType: "driver", actorId: userId, action: "host.kyc.submit", targetType: "host_profile", targetId: updated.id });
  return toPublicProfile(updated);
}

export interface SetPayoutParams {
  accountHolderName: string;
  bankName: string;
  ifsc: string;
  accountNumber: string;
}

/**
 * AC-6/AC-7/AC-10: full account number stored AES-256-GCM encrypted, never
 * returned by any API — including to the host who just typed it — and
 * rejected with a field-level error at write time if malformed rather than
 * discovered at payout time (Sprint 6).
 */
export async function setPayoutDetails(db: Db, userId: string, params: SetPayoutParams) {
  const ifsc = params.ifsc?.trim().toUpperCase();
  const accountNumber = params.accountNumber?.trim();

  if (!ifsc || !IFSC_RE.test(ifsc)) {
    throw new ValidationError("ifsc must match the standard format: 4 letters, '0', 6 alphanumeric characters");
  }
  if (!accountNumber || !ACCOUNT_NUMBER_RE.test(accountNumber)) {
    throw new ValidationError("accountNumber must be 9–18 digits");
  }
  if (!params.accountHolderName?.trim() || !params.bankName?.trim()) {
    throw new ValidationError("accountHolderName and bankName are required");
  }

  const { ciphertext, keyVersion } = encryptField(accountNumber);
  const last4 = accountNumber.slice(-4);

  const [updated] = await db
    .update(hostProfiles)
    .set({
      payoutAccountName: params.accountHolderName,
      payoutBankName: params.bankName,
      payoutIfsc: ifsc,
      payoutAccountLast4: last4,
      payoutAccountEnc: ciphertext,
      payoutKeyVersion: keyVersion,
      payoutAddedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(hostProfiles.userId, userId))
    .returning();
  if (!updated) throw new NotFoundError("Host profile not found");

  await recordAudit(db, { actorType: "driver", actorId: userId, action: "host.payout.set", targetType: "host_profile", targetId: updated.id });

  return { last4, ifsc, bankName: params.bankName };
}

export async function assertOwnsHostProfile(db: Pick<Db, "select">, userId: string, hostProfileId: string): Promise<void> {
  const [row] = await db.select({ id: hostProfiles.id }).from(hostProfiles).where(and(eq(hostProfiles.id, hostProfileId), eq(hostProfiles.userId, userId))).limit(1);
  if (!row) throw new ForbiddenError("You do not own this host profile");
}
