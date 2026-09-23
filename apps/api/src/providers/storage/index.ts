import { env } from "../../env.js";
import { MockStorageProvider } from "./mockStorageProvider.js";
import { S3StorageProvider } from "./s3StorageProvider.js";
import type { StorageProvider } from "./types.js";

let cached: StorageProvider | undefined;

export function createStorageProvider(): StorageProvider {
  if (cached) return cached;
  cached = env.STORAGE_PROVIDER === "s3" ? new S3StorageProvider() : new MockStorageProvider();
  return cached;
}

export { registerMockStorageRoutes } from "./mockStorageProvider.js";
export { registerRequestOriginTracking } from "./requestOrigin.js";
export type { PresignedUpload, StorageClass, StorageProvider } from "./types.js";
