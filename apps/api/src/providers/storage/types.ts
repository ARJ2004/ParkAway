/**
 * Every S3 interaction goes through this interface — business logic never
 * calls the AWS SDK directly (tech-stack.md §8, non-negotiable rule #4).
 * Which concrete implementation is wired up is a config choice
 * (STORAGE_PROVIDER env var), not a code change in the modules that use it.
 *
 * Two sensitivity classes (05-sprint-2-detailed-plan.md §2.7):
 *  - `public`  — listing photos. CDN-frontable, public-read.
 *  - `private` — KYC/ownership/authorization documents. Presigned GET only,
 *    `platform_admin`-only, every issuance audited (see
 *    modules/admin/document-download.service.ts).
 */
export type StorageClass = "public" | "private";

export interface PresignedUpload {
  uploadUrl: string;
  /** Headers the client must send with the PUT for the URL to validate (S3 requires Content-Type to match what was signed). */
  requiredHeaders: Record<string, string>;
  expiresIn: number;
}

export interface StorageProvider {
  /** Issues a presigned PUT URL for a server-generated key — callers never let the client choose the key. */
  getUploadUrl(storageClass: StorageClass, key: string, contentType: string): Promise<PresignedUpload>;
  /** Issues a presigned GET URL. For `private`, callers must audit the issuance before calling this (see the admin document-download service). */
  getDownloadUrl(storageClass: StorageClass, key: string, ttlSeconds: number): Promise<string>;
  /** The URL a `public` object is servable at once uploaded — used for listing photo display, never for `private`. */
  publicUrl(key: string): string;
  delete(storageClass: StorageClass, key: string): Promise<void>;
}
