import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { requireAdminAuth, requireAdminRole } from "../../plugins/authenticate.js";
import { restoreUser, searchUsers, suspendUser } from "./user-management.service.js";

// Both roles are allowed on every route in this module today (Sprint 1's
// stated default — see the plan's Risk #1). Listing them explicitly per
// route, rather than skipping the role check because "everyone's allowed
// anyway", is what makes requireAdminRole a real enforced mechanism instead
// of a no-op — see its doc comment in plugins/authenticate.ts.
const BOTH_ADMIN_ROLES = requireAdminRole("platform_admin", "support");

export async function registerAdminUserRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/admin/users",
    {
      preHandler: [requireAdminAuth, BOTH_ADMIN_ROLES],
      schema: {
        querystring: {
          type: "object",
          required: ["q"],
          properties: { q: { type: "string", minLength: 1 } },
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query as { q: string };
      const results = await searchUsers(db, {
        q,
        role: request.adminAuth!.role,
        actorAdminId: request.adminAuth!.adminId,
        source: request.ip,
      });
      return reply.code(200).send({ users: results });
    }
  );

  app.post(
    "/v1/admin/users/:id/suspend",
    {
      preHandler: [requireAdminAuth, BOTH_ADMIN_ROLES],
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 1 } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const result = await suspendUser(db, {
        userId: id,
        reason,
        actorAdminId: request.adminAuth!.adminId,
        source: request.ip,
      });
      return reply.code(200).send(result);
    }
  );

  app.post(
    "/v1/admin/users/:id/restore",
    {
      preHandler: [requireAdminAuth, BOTH_ADMIN_ROLES],
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 1 } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const result = await restoreUser(db, {
        userId: id,
        reason,
        actorAdminId: request.adminAuth!.adminId,
        source: request.ip,
      });
      return reply.code(200).send(result);
    }
  );
}
