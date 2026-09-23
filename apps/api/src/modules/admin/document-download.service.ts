import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { hostDocuments } from "../../db/schema.js";
import { env } from "../../env.js";
import { recordAudit } from "../../lib/audit.js";
import { NotFoundError } from "../../lib/errors.js";
import { createStorageProvider } from "../../providers/storage/index.js";

/**
 * `platform_admin`-only (enforced at the route level). Writes a
 * `document.download` audit row **before** returning the URL — admin access
 * to identity documents is itself auditable (AC-9, `GATE-11`). If the audit
 * write throws, this function throws too and no URL is ever issued.
 */
export async function getDocumentDownloadUrl(db: Db, adminId: string, documentId: string, source: string | null) {
  const [doc] = await db.select().from(hostDocuments).where(eq(hostDocuments.id, documentId)).limit(1);
  if (!doc) throw new NotFoundError("Document not found");

  await recordAudit(db, {
    actorType: "admin",
    actorId: adminId,
    action: "document.download",
    targetType: "document",
    targetId: documentId,
    source,
    metadata: { ownerType: doc.ownerType, ownerId: doc.ownerId, docType: doc.docType },
  });

  const storage = createStorageProvider();
  const url = await storage.getDownloadUrl("private", doc.storageKey, env.PRESIGNED_DOWNLOAD_TTL_SECONDS);
  return { url, expiresIn: env.PRESIGNED_DOWNLOAD_TTL_SECONDS };
}
