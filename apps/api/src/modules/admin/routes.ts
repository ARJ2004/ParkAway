import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { requireAdminAuth } from "../../plugins/authenticate.js";
import { restoreUser, searchUsers, suspendUser } from "./user-management.service.js";

export async function registerAdminUserRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/admin/users",
    {
      preHandler: requireAdminAuth,
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
      preHandler: requireAdminAuth,
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
      preHandler: requireAdminAuth,
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
