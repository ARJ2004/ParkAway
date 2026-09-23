import { DeleteObjectCommand, PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../env.js";
import type { PresignedUpload, StorageClass, StorageProvider } from "./types.js";

/**
 * Real S3 implementation. CORS on both buckets must permit direct browser
 * PUT from the host/PM origins (Nikhil §5.3) — that's an infra concern, not
 * something this file can fix.
 */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;

  constructor() {
    if (!env.S3_BUCKET_PUBLIC || !env.S3_BUCKET_PRIVATE || !env.S3_REGION) {
      throw new Error(
        "STORAGE_PROVIDER=s3 requires S3_BUCKET_PUBLIC, S3_BUCKET_PRIVATE and S3_REGION to be set. " +
          "Prefer an EC2 instance role over long-lived AWS keys (Nikhil §5.2)."
      );
    }
    // No explicit credentials passed — the SDK's default provider chain
    // picks up an EC2 instance role automatically, which is the preferred
    // path per Nikhil §5.2. Long-lived keys, if ever needed, go through the
    // SDK's standard AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY env vars, not a
    // parameter added here.
    this.client = new S3Client({ region: env.S3_REGION });
  }

  private bucketFor(storageClass: StorageClass): string {
    const bucket = storageClass === "public" ? env.S3_BUCKET_PUBLIC : env.S3_BUCKET_PRIVATE;
    if (!bucket) throw new Error(`No S3 bucket configured for storage class "${storageClass}"`);
    return bucket;
  }

  async getUploadUrl(storageClass: StorageClass, key: string, contentType: string): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucketFor(storageClass),
      Key: key,
      ContentType: contentType,
      ...(storageClass === "public" ? { ACL: "public-read" as const } : {}),
    });
    const expiresIn = env.PRESIGNED_UPLOAD_TTL_SECONDS;
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return { uploadUrl, requiredHeaders: { "Content-Type": contentType }, expiresIn };
  }

  async getDownloadUrl(storageClass: StorageClass, key: string, ttlSeconds: number): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucketFor(storageClass), Key: key });
    return getSignedUrl(this.client, command, { expiresIn: ttlSeconds });
  }

  publicUrl(key: string): string {
    return `https://${this.bucketFor("public")}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
  }

  async delete(storageClass: StorageClass, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketFor(storageClass), Key: key }));
  }
}
