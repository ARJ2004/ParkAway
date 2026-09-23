import type { FastifyReply, FastifyRequest } from "fastify";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { userRoles } from "../db/schema.js";
import { ForbiddenError, UnauthorizedError } from "../lib/errors.js";

/**
 * Persona is navigation. `user_roles` is authorization. They are never the
 * same check (05-sprint-2-detailed-plan.md §2.2a — the part of Group D most
 * likely to be built wrong, stated as a rule rather than left to
 * implementation taste). This queries Postgres directly rather than trusting
 * anything the client sent — no route handler ever branches on a persona
 * value from the request, and the access JWT carries no persona claim.
 *
 * Simplification flagged rather than silently made: the plan's §2.2 calls
 * for this check to be cached "alongside the existing session_version
 * lookup, on the same fail-safe-on-cache-miss terms". This queries Postgres
 * directly on every call instead — correct and simple, at the cost of one
 * extra indexed lookup per host/PM request. Worth revisiting once real
 * request volume on these routes exists; not done here to avoid adding
 * cache-invalidation-on-revoke complexity without a concrete performance
 * signal yet.
 */
export function requireRole(role: "host" | "property_manager") {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.driverAuth) {
      throw new UnauthorizedError(); // wiring bug if reached without requireDriverAuth first
    }
    const [grant] = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(and(eq(userRoles.userId, request.driverAuth.userId), eq(userRoles.role, role), isNull(userRoles.revokedAt)))
      .limit(1);
    if (!grant) {
      throw new ForbiddenError(`This action requires the '${role}' role`);
    }
  };
}

/**
 * `property_manager` grants are scoped to a specific property — this checks
 * the caller holds a live grant for the *exact* property in the route
 * params, not just "property_manager for something". Out-of-scope is 403,
 * never a 404 that looks like "no such property" (AC-10).
 */
export function requirePropertyScope(getPropertyId: (request: FastifyRequest) => string) {
  return async function (request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.driverAuth) {
      throw new UnauthorizedError();
    }
    const propertyId = getPropertyId(request);
    const [grant] = await db
      .select({ id: userRoles.id })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, request.driverAuth.userId),
          eq(userRoles.role, "property_manager"),
          eq(userRoles.scopeType, "property"),
          eq(userRoles.scopeId, propertyId),
          isNull(userRoles.revokedAt)
        )
      )
      .limit(1);
    if (!grant) {
      throw new ForbiddenError("You are not scoped to manage this property");
    }
  };
}
