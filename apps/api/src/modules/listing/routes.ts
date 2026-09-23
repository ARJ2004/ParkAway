import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { requireDriverAuth } from "../../plugins/authenticate.js";
import { archiveListing, pauseListing, resumeListing, submitForPublication } from "./lifecycle.service.js";
import { createListing, getOwnListing, listOwnListings, updateListing } from "./listing.service.js";
import { completePhotoUpload, deletePhoto, listListingPhotos, requestPhotoUploadUrl, updatePhoto } from "./photo.service.js";
import { previewPrice, setPricing } from "../pricing/pricing.service.js";

const listingIdParams = { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } } as const;

export async function registerListingRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/host/listings",
    {
      preHandler: requireDriverAuth,
      schema: {
        body: {
          type: "object",
          required: ["propertyId", "spaceLabel"],
          properties: {
            propertyId: { type: "string", format: "uuid" },
            spaceLabel: { type: "string", minLength: 1 },
            spaceType: { type: "string" },
            capacity: { type: "integer" },
          },
        },
      },
    },
    async (request, reply) => {
      const listing = await createListing(db, request.driverAuth!.userId, request.body as never);
      return reply.code(201).send(listing);
    }
  );

  app.get("/v1/host/listings", { preHandler: requireDriverAuth }, async (request, reply) => {
    const list = await listOwnListings(db, request.driverAuth!.userId);
    return reply.code(200).send({ listings: list });
  });

  app.get("/v1/host/listings/:id", { preHandler: requireDriverAuth, schema: { params: listingIdParams } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const listing = await getOwnListing(db, request.driverAuth!.userId, id);
    return reply.code(200).send(listing);
  });

  app.patch(
    "/v1/host/listings/:id",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: listingIdParams,
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            spaceLabel: { type: "string" },
            vehicleTypes: { type: "array", items: { type: "string" } },
            lengthCm: { type: "integer" },
            widthCm: { type: "integer" },
            heightCm: { type: "integer" },
            covered: { type: "boolean" },
            amenities: { type: "object" },
            accessMethod: { type: "string" },
            rules: { type: "string" },
            location: {
              type: "object",
              required: ["lat", "lng"],
              properties: { lat: { type: "number" }, lng: { type: "number" } },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const listing = await updateListing(db, request.driverAuth!.userId, id, request.body as never);
      return reply.code(200).send(listing);
    }
  );

  app.post(
    "/v1/host/listings/:id/photos/upload-url",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: listingIdParams,
        body: { type: "object", required: ["contentType", "byteSize"], properties: { contentType: { type: "string" }, byteSize: { type: "integer" } } },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { contentType, byteSize } = request.body as { contentType: string; byteSize: number };
      const result = await requestPhotoUploadUrl(db, request.driverAuth!.userId, id, contentType, byteSize);
      return reply.code(201).send(result);
    }
  );

  app.get("/v1/host/listings/:id/photos", { preHandler: requireDriverAuth, schema: { params: listingIdParams } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const photos = await listListingPhotos(db, id);
    return reply.code(200).send({ photos });
  });

  app.post(
    "/v1/host/listings/:id/photos/:photoId/complete",
    {
      preHandler: requireDriverAuth,
      schema: { params: { type: "object", required: ["id", "photoId"], properties: { id: { type: "string" }, photoId: { type: "string" } } } },
    },
    async (request, reply) => {
      const { id, photoId } = request.params as { id: string; photoId: string };
      const photo = await completePhotoUpload(db, request.driverAuth!.userId, id, photoId);
      return reply.code(200).send(photo);
    }
  );

  app.patch(
    "/v1/host/listings/:id/photos/:photoId",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: { type: "object", required: ["id", "photoId"], properties: { id: { type: "string" }, photoId: { type: "string" } } },
        body: { type: "object", additionalProperties: false, properties: { position: { type: "integer" }, isCover: { type: "boolean" } } },
      },
    },
    async (request, reply) => {
      const { id, photoId } = request.params as { id: string; photoId: string };
      const photo = await updatePhoto(db, request.driverAuth!.userId, id, photoId, request.body as never);
      return reply.code(200).send(photo);
    }
  );

  app.delete(
    "/v1/host/listings/:id/photos/:photoId",
    {
      preHandler: requireDriverAuth,
      schema: { params: { type: "object", required: ["id", "photoId"], properties: { id: { type: "string" }, photoId: { type: "string" } } } },
    },
    async (request, reply) => {
      const { id, photoId } = request.params as { id: string; photoId: string };
      await deletePhoto(db, request.driverAuth!.userId, id, photoId);
      return reply.code(204).send();
    }
  );

  app.put(
    "/v1/host/listings/:id/pricing",
    {
      preHandler: requireDriverAuth,
      schema: {
        params: listingIdParams,
        body: {
          type: "object",
          required: ["rules"],
          properties: {
            effectiveFrom: { type: "string" },
            rules: {
              type: "array",
              items: {
                type: "object",
                required: ["ruleType", "amountPaise"],
                properties: {
                  ruleType: { type: "string" },
                  amountPaise: { type: "integer" },
                  daysOfWeek: { type: "array", items: { type: "integer" } },
                  windowStartMin: { type: "integer" },
                  windowEndMin: { type: "integer" },
                  minDurationMin: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const version = await setPricing(db, request.driverAuth!.userId, id, request.body as never);
      return reply.code(201).send(version);
    }
  );

  app.get(
    "/v1/host/listings/:id/pricing/preview",
    { preHandler: requireDriverAuth, schema: { params: listingIdParams } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { start, end } = request.query as { start: string; end: string };
      const breakdown = await previewPrice(db, request.driverAuth!.userId, id, start, end);
      return reply.code(200).send(breakdown);
    }
  );

  app.post("/v1/host/listings/:id/submit", { preHandler: requireDriverAuth, schema: { params: listingIdParams } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const listing = await submitForPublication(db, request.driverAuth!.userId, id);
    return reply.code(200).send(listing);
  });

  app.post("/v1/host/listings/:id/pause", { preHandler: requireDriverAuth, schema: { params: listingIdParams } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const listing = await pauseListing(db, request.driverAuth!.userId, id);
    return reply.code(200).send(listing);
  });

  app.post("/v1/host/listings/:id/resume", { preHandler: requireDriverAuth, schema: { params: listingIdParams } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const listing = await resumeListing(db, request.driverAuth!.userId, id);
    return reply.code(200).send(listing);
  });

  app.post("/v1/host/listings/:id/archive", { preHandler: requireDriverAuth, schema: { params: listingIdParams } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const listing = await archiveListing(db, request.driverAuth!.userId, id);
    return reply.code(200).send(listing);
  });
}
