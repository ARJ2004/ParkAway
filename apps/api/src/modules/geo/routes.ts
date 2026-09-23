import type { FastifyInstance } from "fastify";
import { requireDriverAuth } from "../../plugins/authenticate.js";
import { createMapsProvider } from "../../providers/maps/index.js";

/**
 * Thin wrapper over `MapsProvider` for the two things Sprint 2 needs
 * client-side — reverse-geocode-on-pin-drop and a forward-geocode hint on
 * the address field (§2.7). `SRCH-01`'s real destination search is Sprint 3.
 * No screen calls Mapbox directly; this is the only place that does.
 */
export async function registerGeoRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/v1/geocode",
    {
      preHandler: requireDriverAuth,
      schema: { querystring: { type: "object", required: ["address"], properties: { address: { type: "string", minLength: 1 } } } },
    },
    async (request, reply) => {
      const { address } = request.query as { address: string };
      const result = await createMapsProvider().geocode(address);
      return reply.code(200).send(result);
    }
  );

  app.get(
    "/v1/reverse-geocode",
    {
      preHandler: requireDriverAuth,
      schema: {
        querystring: {
          type: "object",
          required: ["lat", "lng"],
          properties: { lat: { type: "number" }, lng: { type: "number" } },
        },
      },
    },
    async (request, reply) => {
      const { lat, lng } = request.query as { lat: number; lng: number };
      const result = await createMapsProvider().reverseGeocode({ lat, lng });
      return reply.code(200).send(result);
    }
  );
}
