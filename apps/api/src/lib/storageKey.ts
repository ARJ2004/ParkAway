import { randomUUID } from "node:crypto";

/**
 * The server always generates the object key — a client never chooses it
 * (05-sprint-2-detailed-plan.md §3.2). A retried presign issues a new key
 * (harmless; an orphan sweep can reap the old one later); a retried
 * `/complete` on an existing key is a 200 no-op (see host/document.service.ts
 * and listing/photo.service.ts) — R5 in the concurrency plan.
 */
export function generateStorageKey(prefix: string, contentType: string): string {
  const ext = extensionForContentType(contentType);
  return `${prefix}/${randomUUID()}${ext}`;
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "application/pdf":
      return ".pdf";
    default:
      return "";
  }
}
