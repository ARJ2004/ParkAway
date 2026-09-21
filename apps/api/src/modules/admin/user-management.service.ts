import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { users, vehicles } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { normalizeEmail, normalizePhone, normalizeRegistrationNumber } from "../../lib/normalize.js";
import { bumpSessionVersion, type AdminRole } from "../auth/session.service.js";
import { maskEmail, maskPhone } from "./masking.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SearchUsersParams {
  q: string;
  role: AdminRole;
  actorAdminId: string;
  source: string | null;
}

export async function searchUsers(db: Db, params: SearchUsersParams) {
  const q = params.q.trim();
  let rows: (typeof users.$inferSelect)[];

  if (UUID_RE.test(q)) {
    rows = await db.select().from(users).where(eq(users.id, q)).limit(20);
  } else if (q.includes("@")) {
    rows = await db.select().from(users).where(eq(users.email, normalizeEmail(q))).limit(20);
  } else {
    let phoneMatch: string | undefined;
    try {
      phoneMatch = normalizePhone(q);
    } catch {
      phoneMatch = undefined;
    }

    if (phoneMatch) {
      rows = await db.select().from(users).where(eq(users.phone, phoneMatch)).limit(20);
    } else {
      // Fall back to a vehicle-registration lookup.
      const registrationNo = normalizeRegistrationNumber(q);
      const matches = await db
        .select({ user: users })
        .from(vehicles)
        .innerJoin(users, eq(vehicles.userId, users.id))
        .where(eq(vehicles.registrationNo, registrationNo))
        .limit(20);
      rows = matches.map((m) => m.user);
    }
  }

  // Admin PII searches are audited too, not just suspend/restore — relevant to
  // GATE-11 (PII/KYC/payment data handling & retention rules).
  await recordAudit(db, {
    actorType: "admin",
    actorId: params.actorAdminId,
    action: "admin.user_search",
    source: params.source,
    metadata: { query: q, resultCount: rows.length },
  });

  return rows.map((row) => toSearchResult(row, params.role));
}

function toSearchResult(row: typeof users.$inferSelect, role: AdminRole) {
  const masked = role === "support";
  return {
    id: row.id,
    phone: masked ? maskPhone(row.phone) : row.phone,
    name: row.name,
    email: masked ? maskEmail(row.email) : row.email,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export interface SuspendOrRestoreParams {
  userId: string;
  reason: string;
  actorAdminId: string;
  source: string | null;
}

export async function suspendUser(db: Db, params: SuspendOrRestoreParams) {
  if (!params.reason || params.reason.trim().length === 0) {
    throw new ValidationError("A reason is required to suspend a user");
  }

  const [updated] = await db
    .update(users)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(users.id, params.userId))
    .returning();
  if (!updated) throw new NotFoundError("User not found");

  // Forces every existing access token for this driver to fail its next
  // session-version check, bounding how long a just-suspended user's token
  // keeps working to the session-version cache TTL rather than the full
  // access-token TTL.
  await bumpSessionVersion(db, "driver", params.userId);

  await recordAudit(db, {
    actorType: "admin",
    actorId: params.actorAdminId,
    action: "user.suspend",
    targetType: "user",
    targetId: params.userId,
    reason: params.reason,
    source: params.source,
  });

  return { id: updated.id, status: updated.status };
}

export async function restoreUser(db: Db, params: SuspendOrRestoreParams) {
  if (!params.reason || params.reason.trim().length === 0) {
    throw new ValidationError("A reason is required to restore a user");
  }

  const [updated] = await db
    .update(users)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(users.id, params.userId))
    .returning();
  if (!updated) throw new NotFoundError("User not found");

  await recordAudit(db, {
    actorType: "admin",
    actorId: params.actorAdminId,
    action: "user.restore",
    targetType: "user",
    targetId: params.userId,
    reason: params.reason,
    source: params.source,
  });

  return { id: updated.id, status: updated.status };
}
