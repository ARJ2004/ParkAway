import { and, eq, max } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { listingPhotos } from "../../db/schema.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { isUniqueViolation, pgConstraintName } from "../../lib/pgErrors.js";
import { generateStorageKey } from "../../lib/storageKey.js";
import { createStorageProvider } from "../../providers/storage/index.js";
import { assertOwnsListing } from "./listing.service.js";

const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTE_SIZE = 15 * 1024 * 1024;
const COVER_UNIQUE_CONSTRAINT = "listing_photos_cover_unique_idx";

export async function requestPhotoUploadUrl(db: Db, userId: string, listingId: string, contentType: string, byteSize: number) {
  await assertOwnsListing(db, userId, listingId);
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new ValidationError(`contentType must be one of: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`);
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_BYTE_SIZE) {
    throw new ValidationError(`byteSize must be a positive integer no larger than ${MAX_BYTE_SIZE} bytes`);
  }

  const storageKey = generateStorageKey(`listing-photos/${listingId}`, contentType);

  const [maxPositionRow] = await db.select({ maxPosition: max(listingPhotos.position) }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId));
  const [photo] = await db
    .insert(listingPhotos)
    .values({ listingId, storageKey, position: (maxPositionRow?.maxPosition ?? -1) + 1 })
    .returning();
  if (!photo) throw new Error("Listing photo insert returned no row");

  const storage = createStorageProvider();
  const presigned = await storage.getUploadUrl("public", storageKey, contentType);

  return { photoId: photo.id, uploadUrl: presigned.uploadUrl, storageKey, expiresIn: presigned.expiresIn, requiredHeaders: presigned.requiredHeaders };
}

/** Idempotent — a repeated call on an already-completed photo is a 200 no-op (R5). */
export async function completePhotoUpload(db: Db, userId: string, listingId: string, photoId: string) {
  await assertOwnsListing(db, userId, listingId);
  const [photo] = await db.select().from(listingPhotos).where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId))).limit(1);
  if (!photo) throw new NotFoundError("Photo not found");
  if (photo.completedAt) return photo;

  const [updated] = await db.update(listingPhotos).set({ completedAt: new Date() }).where(eq(listingPhotos.id, photoId)).returning();
  return updated ?? photo;
}

/**
 * Attaches a `url` computed via `StorageProvider.publicUrl()` — the client
 * never constructs a storage path itself from a raw key (that would leak
 * the mock/S3 URL shape across the provider boundary, non-negotiable rule 4).
 */
export async function listListingPhotos(db: Db, listingId: string) {
  const rows = await db.select().from(listingPhotos).where(eq(listingPhotos.listingId, listingId)).orderBy(listingPhotos.position);
  const storage = createStorageProvider();
  return rows.map((row) => ({ ...row, url: storage.publicUrl(row.storageKey) }));
}

const MAX_COVER_SWAP_RETRIES = 3;

/**
 * R4: same mechanism as `vehicles_user_id_default_unique_idx` — the
 * database is the guarantee, not the unset-then-set transaction alone.
 * Unset-then-set, retry on the constraint violation.
 */
export async function updatePhoto(db: Db, userId: string, listingId: string, photoId: string, patch: { position?: number; isCover?: boolean }) {
  await assertOwnsListing(db, userId, listingId);

  for (let attempt = 1; attempt <= MAX_COVER_SWAP_RETRIES; attempt++) {
    try {
      return await attemptUpdatePhoto(db, listingId, photoId, patch);
    } catch (err) {
      const isCoverRace = isUniqueViolation(err) && pgConstraintName(err) === COVER_UNIQUE_CONSTRAINT;
      if (!isCoverRace || attempt === MAX_COVER_SWAP_RETRIES) throw err;
    }
  }
  throw new Error("unreachable");
}

async function attemptUpdatePhoto(db: Db, listingId: string, photoId: string, patch: { position?: number; isCover?: boolean }) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(listingPhotos).where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId))).limit(1);
    if (!existing) throw new NotFoundError("Photo not found");

    if (patch.isCover === true) {
      await tx.update(listingPhotos).set({ isCover: false }).where(and(eq(listingPhotos.listingId, listingId), eq(listingPhotos.isCover, true)));
    }

    const [updated] = await tx
      .update(listingPhotos)
      .set({
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        ...(patch.isCover !== undefined ? { isCover: patch.isCover } : {}),
      })
      .where(eq(listingPhotos.id, photoId))
      .returning();
    if (!updated) throw new NotFoundError("Photo not found");
    return updated;
  });
}

export async function deletePhoto(db: Db, userId: string, listingId: string, photoId: string) {
  await assertOwnsListing(db, userId, listingId);
  const [photo] = await db.select().from(listingPhotos).where(and(eq(listingPhotos.id, photoId), eq(listingPhotos.listingId, listingId))).limit(1);
  if (!photo) throw new NotFoundError("Photo not found");

  const storage = createStorageProvider();
  await storage.delete("public", photo.storageKey);
  await db.delete(listingPhotos).where(eq(listingPhotos.id, photoId));
}
