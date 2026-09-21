import { eq } from "drizzle-orm";
import type { Db } from "../../db/client.js";
import { adminUsers } from "../../db/schema.js";
import { env } from "../../env.js";
import { recordAudit } from "../../lib/audit.js";
import { hashPassword, verifyPassword } from "../../lib/crypto.js";
import { normalizeEmail } from "../../lib/normalize.js";
import { RateLimitedError, UnauthorizedError } from "../../lib/errors.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { issueSession, type IssuedSession, type AdminRole } from "../auth/session.service.js";

// Used only to keep bcrypt.compare's timing consistent when the email isn't
// found, so a login attempt doesn't leak account existence via response time.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8p1kFrqNjRPHIrq4qGoJdG0OT2jz3G";

export interface AdminLoginParams {
  email: string;
  password: string;
  ip: string;
}

export interface AdminLoginResult extends IssuedSession {
  adminId: string;
  role: AdminRole;
}

export async function adminLogin(db: Db, params: AdminLoginParams): Promise<AdminLoginResult> {
  const email = normalizeEmail(params.email);

  const [acctLimit, ipLimit] = await Promise.all([
    checkRateLimit(`admin:login:acct:${email}`, env.ADMIN_LOGIN_RATE_LIMIT_PER_ACCOUNT_PER_15MIN, 900),
    checkRateLimit(`admin:login:ip:${params.ip}`, env.ADMIN_LOGIN_RATE_LIMIT_PER_IP_PER_15MIN, 900),
  ]);

  if (!acctLimit.allowed || !ipLimit.allowed) {
    await recordAudit(db, {
      actorType: "system",
      action: "admin.login_rate_limited",
      source: params.ip,
      metadata: { email },
    });
    throw new RateLimitedError("Too many login attempts — please try again later");
  }

  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);

  const passwordOk = await verifyPassword(params.password, admin?.passwordHash ?? DUMMY_HASH);

  if (!admin || !passwordOk) {
    await recordAudit(db, {
      actorType: "system",
      action: "admin.login_failed",
      targetType: admin ? "admin_user" : undefined,
      targetId: admin?.id,
      source: params.ip,
      metadata: { email },
    });
    // Deliberately generic — never reveal whether the email exists.
    throw new UnauthorizedError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  if (admin.status === "suspended") {
    await recordAudit(db, {
      actorType: "system",
      action: "admin.login_rejected_suspended",
      targetType: "admin_user",
      targetId: admin.id,
      source: params.ip,
    });
    throw new UnauthorizedError("ACCOUNT_SUSPENDED", "This admin account is suspended");
  }

  const role = admin.role as AdminRole;
  const session = await issueSession(db, "admin", admin.id, admin.sessionVersion, { role });

  await recordAudit(db, {
    actorType: "admin",
    actorId: admin.id,
    action: "admin.login_success",
    targetType: "admin_user",
    targetId: admin.id,
    source: params.ip,
  });

  return { ...session, adminId: admin.id, role };
}

export async function createAdminUser(
  db: Db,
  params: { email: string; password: string; role: AdminRole }
): Promise<{ id: string }> {
  const [row] = await db
    .insert(adminUsers)
    .values({
      email: normalizeEmail(params.email),
      passwordHash: await hashPassword(params.password),
      role: params.role,
    })
    .returning({ id: adminUsers.id });
  if (!row) throw new Error("Admin user insert returned no row");
  return row;
}
