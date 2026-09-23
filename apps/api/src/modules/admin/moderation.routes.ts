import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { requireAdminAuth, requireAdminRole } from "../../plugins/authenticate.js";
import { getDocumentDownloadUrl } from "./document-download.service.js";
import { approveKyc, getHostKycDetail, rejectKyc } from "./kyc-review.service.js";
import { approveListing, getModerationDetail, listModerationQueue, rejectListing, suspendListing } from "./moderation.service.js";
import { revealPayoutAccount } from "./payout-reveal.service.js";

const PLATFORM_ADMIN_ONLY = requireAdminRole("platform_admin");
const BOTH_ADMIN_ROLES = requireAdminRole("platform_admin", "support");

export async function registerAdminModerationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/admin/listings",
    { preHandler: [requireAdminAuth, BOTH_ADMIN_ROLES] },
    async (request, reply) => {
      const { status, propertyId } = request.query as { status?: string; propertyId?: string };
      const queue = await listModerationQueue(db, { status, propertyId, role: request.adminAuth!.role });
      return reply.code(200).send({ listings: queue });
    }
  );

  app.get(
    "/v1/admin/listings/:id",
    { preHandler: [requireAdminAuth, BOTH_ADMIN_ROLES], schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const detail = await getModerationDetail(db, id, request.adminAuth!.role);
      return reply.code(200).send(detail);
    }
  );

  app.post(
    "/v1/admin/listings/:id/approve",
    {
      preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY],
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: {
          type: "object",
          required: ["level", "reasonCategory"],
          properties: { level: { type: "integer" }, expiresAt: { type: "string" }, reasonCategory: { type: "string" }, note: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const listing = await approveListing(db, request.adminAuth!.adminId, id, request.body as never, request.ip);
      return reply.code(200).send(listing);
    }
  );

  app.post(
    "/v1/admin/listings/:id/reject",
    {
      preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY],
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: { type: "object", required: ["reasonCategory"], properties: { reasonCategory: { type: "string" }, note: { type: "string" } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reasonCategory, note } = request.body as { reasonCategory: string; note?: string };
      const listing = await rejectListing(db, request.adminAuth!.adminId, id, reasonCategory, note, request.ip);
      return reply.code(200).send(listing);
    }
  );

  app.post(
    "/v1/admin/listings/:id/suspend",
    {
      preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY],
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: { type: "object", required: ["reasonCategory"], properties: { reasonCategory: { type: "string" }, note: { type: "string" } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reasonCategory, note } = request.body as { reasonCategory: string; note?: string };
      const listing = await suspendListing(db, request.adminAuth!.adminId, id, reasonCategory, note, request.ip);
      return reply.code(200).send(listing);
    }
  );

  app.get(
    "/v1/admin/hosts/:id/kyc",
    { preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY], schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const detail = await getHostKycDetail(db, id);
      return reply.code(200).send(detail);
    }
  );

  app.post(
    "/v1/admin/hosts/:id/kyc/approve",
    { preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY], schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const profile = await approveKyc(db, request.adminAuth!.adminId, id, request.ip);
      return reply.code(200).send(profile);
    }
  );

  app.post(
    "/v1/admin/hosts/:id/kyc/reject",
    {
      preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY],
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 1 } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const profile = await rejectKyc(db, request.adminAuth!.adminId, id, reason, request.ip);
      return reply.code(200).send(profile);
    }
  );

  app.get(
    "/v1/admin/documents/:id/download-url",
    { preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY], schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await getDocumentDownloadUrl(db, request.adminAuth!.adminId, id, request.ip);
      return reply.code(200).send(result);
    }
  );

  app.post(
    "/v1/admin/hosts/:id/payout/reveal",
    {
      preHandler: [requireAdminAuth, PLATFORM_ADMIN_ONLY],
      schema: {
        params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } },
        body: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 1 } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason: string };
      const result = await revealPayoutAccount(db, request.adminAuth!.adminId, id, reason, request.ip);
      return reply.code(200).send(result);
    }
  );
}
