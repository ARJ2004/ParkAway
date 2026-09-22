import type { FastifyReply, FastifyRequest } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";
import { checkSessionVersion, verifyAccessToken, type AdminRole } from "../modules/auth/session.service.js";

function extractBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("MISSING_TOKEN", "Missing bearer token");
  }
  return header.slice("Bearer ".length);
}

/** Requires a valid driver access token. Attaches `request.driverAuth`. */
export async function requireDriverAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request);
  const claims = verifyAccessToken(token);

  if (claims.userType !== "driver") {
    throw new UnauthorizedError("WRONG_TOKEN_TYPE", "Admin tokens cannot be used on driver endpoints");
  }

  await checkSessionVersion("driver", claims.sub, claims.sessionVersion);
  request.driverAuth = { userId: claims.sub, sessionVersion: claims.sessionVersion };
}

/** Requires a valid admin access token. Attaches `request.adminAuth`. Does not check role — compose with requireAdminRole(...) for that. */
export async function requireAdminAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request);
  const claims = verifyAccessToken(token);

  if (claims.userType !== "admin" || !claims.role) {
    throw new UnauthorizedError("WRONG_TOKEN_TYPE", "Driver tokens cannot be used on admin endpoints");
  }

  await checkSessionVersion("admin", claims.sub, claims.sessionVersion);
  request.adminAuth = { adminId: claims.sub, role: claims.role, sessionVersion: claims.sessionVersion };
}

/**
 * Per-role authorization, composed as a second preHandler after
 * `requireAdminAuth` (which only checks "is this a valid admin token" — not
 * which role). `ADM-01` AC9 requires an admin without permission for an
 * action to be rejected with 403, not a silent no-op; this is the actual
 * enforcing mechanism for that, previously referenced by a comment but never
 * implemented (caught by an audit against the original acceptance criteria).
 *
 * Both `platform_admin` and `support` are currently allowed on every
 * existing admin route (the Sprint 1 plan's stated default — see Risk #1,
 * `docs/planning/04-sprint-1-detailed-plan.md`), so this doesn't visibly
 * restrict anything yet. The point is that the mechanism is now real and
 * tested, so tightening a specific route later is a one-line change to its
 * `requireAdminRole(...)` call, not new infrastructure.
 */
export function requireAdminRole(...allowedRoles: AdminRole[]) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.adminAuth) {
      // Only reachable if wired without requireAdminAuth running first — a
      // wiring bug, not a real unauthenticated-caller scenario.
      throw new UnauthorizedError();
    }
    if (!allowedRoles.includes(request.adminAuth.role)) {
      throw new ForbiddenError(`This action requires one of: ${allowedRoles.join(", ")}`);
    }
  };
}
