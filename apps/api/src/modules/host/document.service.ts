import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { hostDocuments } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { generateStorageKey } from "../../lib/storageKey.js";
import { createStorageProvider } from "../../providers/storage/index.js";
import { assertScoped as assertPropertyScoped } from "../property/property.service.js";
import { assertOwnsHostProfile } from "./host-profile.service.js";

const DOC_TYPES = ["pan", "aadhaar", "ownership_proof", "authorization_letter", "utility_bill", "business_reg"] as const;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_BYTE_SIZE = 15 * 1024 * 1024; // 15MB

export interface RequestUploadUrlParams {
  docType: string;
  contentType: string;
  byteSize: number;
  ownerType: "host_profile" | "property";
  ownerId: string;
}

/**
 * Presign endpoints validate resource ownership *before* issuing a URL, pick
 * the bucket class from the document type (never from client input — always
 * `private` for every doc type this table stores), and cap byteSize/
 * contentType at issue time (§3.2). AC-11: requesting an upload URL for
 * another host's profile (or a property you're not scoped to) is 403.
 */
export async function requestDocumentUploadUrl(db: Db, userId: string, params: RequestUploadUrlParams) {
  if (!DOC_TYPES.includes(params.docType as (typeof DOC_TYPES)[number])) {
    throw new ValidationError(`docType must be one of: ${DOC_TYPES.join(", ")}`);
  }
  if (!ALLOWED_CONTENT_TYPES.has(params.contentType)) {
    throw new ValidationError(`contentType must be one of: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`);
  }
  if (!Number.isInteger(params.byteSize) || params.byteSize <= 0 || params.byteSize > MAX_BYTE_SIZE) {
    throw new ValidationError(`byteSize must be a positive integer no larger than ${MAX_BYTE_SIZE} bytes`);
  }

  if (params.ownerType === "host_profile") {
    await assertOwnsHostProfile(db, userId, params.ownerId);
  } else if (params.ownerType === "property") {
    await assertPropertyScoped(db, userId, params.ownerId);
  } else {
    throw new ValidationError("ownerType must be 'host_profile' or 'property'");
  }

  const storageKey = generateStorageKey(`host-documents/${params.ownerType}/${params.ownerId}`, params.contentType);

  const [document] = await db
    .insert(hostDocuments)
    .values({
      ownerType: params.ownerType,
      ownerId: params.ownerId,
      docType: params.docType,
      storageKey,
      contentType: params.contentType,
      byteSize: params.byteSize,
      uploadedByUserId: userId,
    })
    .returning();
  if (!document) throw new Error("Document insert returned no row");

  const storage = createStorageProvider();
  const presigned = await storage.getUploadUrl("private", storageKey, params.contentType);

  await recordAudit(db, {
    actorType: "driver",
    actorId: userId,
    action: "document.upload",
    targetType: "document",
    targetId: document.id,
    metadata: { docType: params.docType, ownerType: params.ownerType, ownerId: params.ownerId },
  });

  return { documentId: document.id, uploadUrl: presigned.uploadUrl, storageKey, expiresIn: presigned.expiresIn, requiredHeaders: presigned.requiredHeaders };
}

/** Idempotent — a repeated call on an already-completed document is a 200 no-op (R5). */
export async function completeDocumentUpload(db: Db, userId: string, documentId: string) {
  const [doc] = await db.select().from(hostDocuments).where(eq(hostDocuments.id, documentId)).limit(1);
  if (!doc) throw new NotFoundError("Document not found");
  if (doc.uploadedByUserId !== userId) throw new ForbiddenError("You did not initiate this upload");

  if (doc.completedAt) return doc; // no-op

  const [updated] = await db.update(hostDocuments).set({ completedAt: new Date() }).where(eq(hostDocuments.id, documentId)).returning();
  return updated ?? doc;
}
