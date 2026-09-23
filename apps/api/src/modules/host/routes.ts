import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { requireDriverAuth } from "../../plugins/authenticate.js";
import { completeDocumentUpload, requestDocumentUploadUrl } from "./document.service.js";
import { createHostProfile, getOwnHostProfile, getOwnHostProfileId, setPayoutDetails, submitKyc, updateHostProfile } from "./host-profile.service.js";
import { ForbiddenError } from "../../lib/errors.js";

export async function registerHostRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/host/profile",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          required: ["hostType", "legalName"],
          properties: {
            hostType: { type: "string" },
            legalName: { type: "string", minLength: 1 },
            businessName: { type: "string" },
            gstin: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const profile = await createHostProfile(db, request.driverAuth!.userId, request.body as never);
      return reply.code(201).send(profile);
    }
  );

  app.get("/v1/host/profile", { preHandler: requireDriverAuth }, async (request, reply) => {
    const profile = await getOwnHostProfile(db, request.driverAuth!.userId);
    return reply.code(200).send(profile);
  });

  app.patch(
    "/v1/host/profile",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: { legalName: { type: "string" }, businessName: { type: "string" }, gstin: { type: "string" } },
        },
      },
    },
    async (request, reply) => {
      const profile = await updateHostProfile(db, request.driverAuth!.userId, request.body as never);
      return reply.code(200).send(profile);
    }
  );

  app.post(
    "/v1/host/documents/upload-url",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          required: ["docType", "contentType", "byteSize"],
          properties: {
            docType: { type: "string" },
            contentType: { type: "string" },
            byteSize: { type: "integer" },
            ownerType: { type: "string", enum: ["host_profile", "property"] },
            ownerId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { docType: string; contentType: string; byteSize: number; ownerType?: "host_profile" | "property"; ownerId?: string };
      const ownerType = body.ownerType ?? "host_profile";
      let ownerId = body.ownerId;
      if (ownerType === "host_profile" && !ownerId) {
        const hostProfileId = await getOwnHostProfileId(db, request.driverAuth!.userId);
        if (!hostProfileId) throw new ForbiddenError("Create a host profile before uploading documents");
        ownerId = hostProfileId;
      }
      if (!ownerId) throw new ForbiddenError("ownerId is required for a property document");

      const result = await requestDocumentUploadUrl(db, request.driverAuth!.userId, { ...body, ownerType, ownerId });
      return reply.code(201).send(result);
    }
  );

  app.post(
    "/v1/host/documents/:id/complete",
    {
      preHandler: requireDriverAuth,
      schema: { params: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const doc = await completeDocumentUpload(db, request.driverAuth!.userId, id);
      return reply.code(200).send(doc);
    }
  );

  app.post("/v1/host/profile/kyc/submit", { preHandler: requireDriverAuth }, async (request, reply) => {
    const profile = await submitKyc(db, request.driverAuth!.userId);
    return reply.code(200).send(profile);
  });

  app.put(
    "/v1/host/profile/payout",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          required: ["accountHolderName", "bankName", "ifsc", "accountNumber"],
          properties: {
            accountHolderName: { type: "string", minLength: 1 },
            bankName: { type: "string", minLength: 1 },
            ifsc: { type: "string" },
            accountNumber: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await setPayoutDetails(db, request.driverAuth!.userId, request.body as never);
      return reply.code(200).send(result);
    }
  );
}
