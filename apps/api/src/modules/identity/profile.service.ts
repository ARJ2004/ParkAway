import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { users } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { normalizeEmail } from "../../lib/normalize.js";

export interface ProfilePatch {
  name?: string;
  email?: string;
  photoUrl?: string;
  commPrefs?: { push?: boolean; sms?: boolean; whatsapp?: boolean; email?: boolean };
  // Present only to detect and reject an attempted phone change (AC: DRV-02 #2).
  phone?: unknown;
}

const MAX_NAME_LENGTH = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getProfile(db: Db, userId: string) {
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!row) throw new NotFoundError("User not found");
  return toPublicProfile(row);
}

export async function updateProfile(db: Db, userId: string, patch: ProfilePatch, source: string | null) {
  // Phone is the verified identity anchor — reject a bare phone-field update
  // outright rather than silently ignoring it (non-negotiable per the Sprint 1
  // plan's Risk #3: silently ignoring it would be indistinguishable from a bug
  // to a caller, and this must be a hard, visible rejection).
  if ("phone" in patch) {
    throw new ValidationError("Phone number cannot be changed via profile update — it is the verified identity anchor");
  }

  if (patch.name !== undefined && patch.name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }

  let normalizedEmail: string | undefined;
  if (patch.email !== undefined) {
    if (!EMAIL_RE.test(patch.email)) {
      throw new ValidationError("Invalid email format");
    }
    normalizedEmail = normalizeEmail(patch.email);
  }

  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) throw new NotFoundError("User not found");

  const emailChanged = normalizedEmail !== undefined && normalizedEmail !== current.email;

  const [updated] = await db
    .update(users)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(normalizedEmail !== undefined ? { email: normalizedEmail } : {}),
      ...(patch.photoUrl !== undefined ? { photoUrl: patch.photoUrl } : {}),
      ...(patch.commPrefs !== undefined ? { commPrefs: patch.commPrefs } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  if (!updated) throw new NotFoundError("User not found");

  if (emailChanged) {
    await recordAudit(db, {
      actorType: "driver",
      actorId: userId,
      action: "profile.email_change",
      targetType: "user",
      targetId: userId,
      source,
      metadata: { from: current.email, to: normalizedEmail },
    });
  }

  return toPublicProfile(updated);
}

function toPublicProfile(row: typeof users.$inferSelect) {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    photoUrl: row.photoUrl,
    commPrefs: row.commPrefs,
    status: row.status,
    onboardingWizardCompletedAt: row.onboardingWizardCompletedAt,
  };
}
