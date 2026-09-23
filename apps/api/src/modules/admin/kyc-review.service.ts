import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { hostDocuments, hostProfiles } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";

function toPublicProfile<T extends { payoutAccountEnc: string | null; payoutKeyVersion: number | null }>(row: T) {
  const { payoutAccountEnc: _enc, payoutKeyVersion: _v, ...rest } = row;
  return rest;
}

export async function getHostKycDetail(db: Db, hostProfileId: string) {
  const [profile] = await db.select().from(hostProfiles).where(eq(hostProfiles.id, hostProfileId)).limit(1);
  if (!profile) throw new NotFoundError("Host profile not found");
  const documents = await db.select().from(hostDocuments).where(eq(hostDocuments.ownerType, "host_profile"));
  return { profile: toPublicProfile(profile), documents: documents.filter((d) => d.ownerId === hostProfileId) };
}

export async function approveKyc(db: Db, adminId: string, hostProfileId: string, source: string | null) {
  const [existing] = await db.select({ kycStatus: hostProfiles.kycStatus }).from(hostProfiles).where(eq(hostProfiles.id, hostProfileId)).limit(1);
  if (!existing) throw new NotFoundError("Host profile not found");
  if (existing.kycStatus !== "submitted") {
    throw new ConflictError("KYC_STATE_CONFLICT", `KYC is currently '${existing.kycStatus}', not 'submitted'`);
  }

  const [updated] = await db
    .update(hostProfiles)
    .set({ kycStatus: "verified", kycReviewedBy: adminId, kycReviewedAt: new Date(), kycRejectionReason: null, updatedAt: new Date() })
    .where(eq(hostProfiles.id, hostProfileId))
    .returning();
  if (!updated) throw new NotFoundError("Host profile not found");

  await recordAudit(db, { actorType: "admin", actorId: adminId, action: "host.kyc.approve", targetType: "host_profile", targetId: hostProfileId, source });
  return toPublicProfile(updated);
}

export async function rejectKyc(db: Db, adminId: string, hostProfileId: string, reason: string, source: string | null) {
  if (!reason?.trim()) throw new ValidationError("reason is required");

  const [existing] = await db.select({ kycStatus: hostProfiles.kycStatus }).from(hostProfiles).where(eq(hostProfiles.id, hostProfileId)).limit(1);
  if (!existing) throw new NotFoundError("Host profile not found");
  if (existing.kycStatus !== "submitted") {
    throw new ConflictError("KYC_STATE_CONFLICT", `KYC is currently '${existing.kycStatus}', not 'submitted'`);
  }

  const [updated] = await db
    .update(hostProfiles)
    .set({ kycStatus: "rejected", kycReviewedBy: adminId, kycReviewedAt: new Date(), kycRejectionReason: reason, updatedAt: new Date() })
    .where(eq(hostProfiles.id, hostProfileId))
    .returning();
  if (!updated) throw new NotFoundError("Host profile not found");

  await recordAudit(db, { actorType: "admin", actorId: adminId, action: "host.kyc.reject", targetType: "host_profile", targetId: hostProfileId, reason, source });
  return toPublicProfile(updated);
}
