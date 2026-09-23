import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { requireDriverAuth } from "../../plugins/authenticate.js";
import { getPersonas, selectPersona } from "./persona.service.js";
import { getProfile, updateProfile } from "./profile.service.js";
import { addVehicle, listVehicles, updateVehicle } from "./vehicle.service.js";

export async function registerIdentityRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/me/personas", { preHandler: requireDriverAuth }, async (request, reply) => {
    const personas = await getPersonas(db, request.driverAuth!.userId);
    return reply.code(200).send(personas);
  });

  app.post(
    "/v1/me/personas/select",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          required: ["persona"],
          properties: { persona: { type: "string", enum: ["driver", "owner"] } },
        },
      },
    },
    async (request, reply) => {
      const { persona } = request.body as { persona: string };
      const result = await selectPersona(db, request.driverAuth!.userId, persona, request.ip);
      return reply.code(200).send(result);
    }
  );

  app.get("/v1/me/profile", { preHandler: requireDriverAuth }, async (request, reply) => {
    const profile = await getProfile(db, request.driverAuth!.userId);
    return reply.code(200).send(profile);
  });

  app.patch(
    "/v1/me/profile",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            photoUrl: { type: "string" },
            commPrefs: {
              type: "object",
              properties: {
                push: { type: "boolean" },
                sms: { type: "boolean" },
                whatsapp: { type: "boolean" },
                email: { type: "boolean" },
              },
            },
            phone: {}, // deliberately accepted by schema so the service layer can reject it explicitly (422), not silently strip it
          },
        },
      },
    },
    async (request, reply) => {
      const profile = await updateProfile(db, request.driverAuth!.userId, request.body as never, request.ip);
      return reply.code(200).send(profile);
    }
  );

  app.get("/v1/me/vehicles", { preHandler: requireDriverAuth }, async (request, reply) => {
    const list = await listVehicles(db, request.driverAuth!.userId);
    return reply.code(200).send({ vehicles: list });
  });

  app.post(
    "/v1/me/vehicles",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          required: ["registrationNo", "type"],
          properties: {
            registrationNo: { type: "string", minLength: 4, maxLength: 20 },
            type: { type: "string" },
            makeModel: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const vehicle = await addVehicle(db, request.driverAuth!.userId, request.body as never);
      return reply.code(201).send(vehicle);
    }
  );

  app.patch(
    "/v1/me/vehicles/:id",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            makeModel: { type: "string" },
            isDefault: { type: "boolean" },
            status: { type: "string", enum: ["active", "inactive"] },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const vehicle = await updateVehicle(db, request.driverAuth!.userId, id, request.body as never);
      return reply.code(200).send(vehicle);
    }
  );
}
