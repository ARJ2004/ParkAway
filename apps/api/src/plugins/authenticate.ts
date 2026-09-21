import type { FastifyReply, FastifyRequest } from "fastify";
import { UnauthorizedError } from "../lib/errors.js";
import { checkSessionVersion, verifyAccessToken } from "../modules/auth/session.service.js";

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

/** Requires a valid admin access token. Attaches `request.adminAuth`. Does not check role — see requireAdminRole. */
export async function requireAdminAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = extractBearerToken(request);
  const claims = verifyAccessToken(token);

  if (claims.userType !== "admin" || !claims.role) {
    throw new UnauthorizedError("WRONG_TOKEN_TYPE", "Driver tokens cannot be used on admin endpoints");
  }

  await checkSessionVersion("admin", claims.sub, claims.sessionVersion);
  request.adminAuth = { adminId: claims.sub, role: claims.role, sessionVersion: claims.sessionVersion };
}
