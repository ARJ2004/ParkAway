import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { requireDriverAuth } from "../../plugins/authenticate.js";
import { addAccessPolicyVersion, getAccessPolicy } from "./access-policy.service.js";
import { grantAuthorization, getLatestAuthorization, revokeAuthorization } from "./authorization.service.js";
import { createProperty, getProperty, listProperties, updateProperty } from "./property.service.js";

const propertyIdParams = {
  type: "object",
  required: ["id"],
  properties: { id: { type: "string", format: "uuid" } },
} as const;

const latLngSchema = {
  type: "object",
  required: ["lat", "lng"],
  properties: { lat: { type: "number" }, lng: { type: "number" } },
} as const;

export async function registerPropertyRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/properties",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          required: ["name", "propertyType", "addressLine1", "locality", "city", "state", "pincode", "location", "entryLocation", "outsiderPolicy"],
          properties: {
            name: { type: "string", minLength: 1 },
            propertyType: { type: "string" },
            addressLine1: { type: "string", minLength: 1 },
            addressLine2: { type: "string" },
            locality: { type: "string", minLength: 1 },
            city: { type: "string", minLength: 1 },
            state: { type: "string", minLength: 1 },
            pincode: { type: "string", minLength: 1 },
            location: latLngSchema,
            entryLocation: latLngSchema,
            outsiderPolicy: { type: "string" },
            securityContacts: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "phone", "role"],
                properties: { name: { type: "string" }, phone: { type: "string" }, role: { type: "string" } },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const property = await createProperty(db, request.driverAuth!.userId, request.body as never);
      return reply.code(201).send(property);
    }
  );

  app.get("/v1/properties", { preHandler: requireDriverAuth }, async (request, reply) => {
    const list = await listProperties(db, request.driverAuth!.userId);
    return reply.code(200).send({ properties: list });
  });

  app.get("/v1/properties/:id", { preHandler: requireDriverAuth, schema: { params: propertyIdParams } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const property = await getProperty(db, request.driverAuth!.userId, id);
    return reply.code(200).send(property);
  });

  app.patch(
    "/v1/properties/:id",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: propertyIdParams,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            addressLine1: { type: "string" },
            addressLine2: { type: "string" },
            outsiderPolicy: { type: "string" },
            securityContacts: { type: "array" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const property = await updateProperty(db, request.driverAuth!.userId, id, request.body as never);
      return reply.code(200).send(property);
    }
  );

  app.post(
    "/v1/properties/:id/authorizations",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: propertyIdParams,
        body: {
          type: "object",
          required: ["authorizationType", "permittedParkingTypes", "outsiderPolicy", "effectiveFrom"],
          properties: {
            authorizationType: { type: "string" },
            permittedParkingTypes: { type: "array", items: { type: "string" } },
            outsiderPolicy: { type: "string" },
            effectiveFrom: { type: "string" },
            expiresAt: { type: "string" },
            documentId: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const authorization = await grantAuthorization(db, request.driverAuth!.userId, id, request.body as never, request.ip);
      return reply.code(201).send(authorization);
    }
  );

  app.get(
    "/v1/properties/:id/authorizations/current",
    { preHandler: requireDriverAuth, schema: { params: propertyIdParams } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { all } = request.query as { all?: string };
      const authorization = await getLatestAuthorization(db, request.driverAuth!.userId, id, all === "true");
      return reply.code(200).send(authorization);
    }
  );

  app.post(
    "/v1/properties/:id/authorizations/:aid/revoke",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: {
          type: "object",
          required: ["id", "aid"],
          properties: { id: { type: "string", format: "uuid" }, aid: { type: "string", format: "uuid" } },
        },
        body: { type: "object", required: ["reason"], properties: { reason: { type: "string", minLength: 1 } } },
      },
    },
    async (request, reply) => {
      const { id, aid } = request.params as { id: string; aid: string };
      const { reason } = request.body as { reason: string };
      const result = await revokeAuthorization(db, request.driverAuth!.userId, id, aid, reason, request.ip);
      return reply.code(200).send(result);
    }
  );

  app.get(
    "/v1/properties/:id/access-policy",
    { preHandler: requireDriverAuth, schema: { params: propertyIdParams } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { all } = request.query as { all?: string };
      const policy = await getAccessPolicy(db, request.driverAuth!.userId, id, all === "true");
      return reply.code(200).send(policy);
    }
  );

  app.post(
    "/v1/properties/:id/access-policy",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: propertyIdParams,
        body: {
          type: "object",
          required: ["gateHours", "accessMethods", "effectiveFrom"],
          properties: {
            gateHours: {},
            accessMethods: { type: "array", items: { type: "string" } },
            escortRequired: { type: "boolean" },
            emergencyOverrideContact: { type: ["object", "null"] },
            effectiveFrom: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const policy = await addAccessPolicyVersion(db, request.driverAuth!.userId, id, request.body as never, request.ip);
      return reply.code(201).send(policy);
    }
  );
}
