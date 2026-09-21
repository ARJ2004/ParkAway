import type { Db } from "../db/client.js";
import { auditLog } from "../db/schema.js";

export type ActorType = "driver" | "admin" | "system";
export type TargetType = "user" | "vehicle" | "admin_user";

export interface RecordAuditParams {
  actorType: ActorType;
  actorId?: string | null;
  action: string;
  targetType?: TargetType;
  targetId?: string | null;
  reason?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Single write path for the audit trail. Every status-changing action in the
 * codebase should go through this rather than writing to `audit_log` directly,
 * so "actor, timestamp, source, reason on every status change" (non-negotiable
 * rule #6) is structurally hard to forget rather than a convention someone has
 * to remember per-route.
 */
export async function recordAudit(db: Db, params: RecordAuditParams): Promise<void> {
  await db.insert(auditLog).values({
    actorType: params.actorType,
    actorId: params.actorId ?? null,
    action: params.action,
    targetType: params.targetType ?? null,
    targetId: params.targetId ?? null,
    reason: params.reason ?? null,
    source: params.source ?? null,
    metadata: params.metadata ?? null,
  });
}
