import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { hostProfiles } from "../../db/schema.js";
import { recordAudit } from "../../lib/audit.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { decryptField } from "../../lib/fieldCrypto.js";

/**
 * `platform_admin`-only (enforced at the route level; `support` receives
 * 403 before ever reaching this function). Returns the decrypted account
 * number **once** — the audit row is written before decryption, so a crash
 * between the two still leaves a record that a reveal was attempted (AC-8).
 * This is one of exactly two call sites for `decryptField` in the codebase.
 */
export async function revealPayoutAccount(db: Db, adminId: string, hostProfileId: string, reason: string, source: string | null) {
  if (!reason?.trim()) throw new ValidationError("reason is required");

  const [host] = await db.select().from(hostProfiles).where(eq(hostProfiles.id, hostProfileId)).limit(1);
  if (!host) throw new NotFoundError("Host profile not found");
  if (!host.payoutAccountEnc || host.payoutKeyVersion === null) {
    throw new ConflictError("NO_PAYOUT_ACCOUNT", "No payout account is on file for this host");
  }

  await recordAudit(db, { actorType: "admin", actorId: adminId, action: "host.payout.revealed", targetType: "host_profile", targetId: hostProfileId, reason, source });

  const accountNumber = decryptField(host.payoutAccountEnc, host.payoutKeyVersion);
  return { accountNumber, ifsc: host.payoutIfsc, bankName: host.payoutBankName, accountHolderName: host.payoutAccountName };
}
