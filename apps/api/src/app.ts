import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { env } from "./env.js";
import { AppError, errorBody } from "./lib/errors.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerAdminAuthRoutes } from "./modules/admin-auth/routes.js";
import { registerIdentityRoutes } from "./modules/identity/routes.js";
import { registerAdminUserRoutes } from "./modules/admin/routes.js";
import { registerAdminModerationRoutes } from "./modules/admin/moderation.routes.js";
import { registerPropertyRoutes } from "./modules/property/routes.js";
import { registerHostRoutes } from "./modules/host/routes.js";
import { registerListingRoutes } from "./modules/listing/routes.js";
import { registerGeoRoutes } from "./modules/geo/routes.js";
import { registerMockStorageRoutes, registerRequestOriginTracking } from "./providers/storage/index.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
    trustProxy: true,
  });

  app.get("/healthz", async () => ({ status: "ok" }));

  // Dev-only: lets the mock StorageProvider return URLs that resolve for
  // whichever host the client actually connected on (browser on the same
  // machine → localhost; phone/emulator → the dev machine's LAN IP) instead
  // of a single hardcoded STORAGE_MOCK_BASE_URL that only works for one of
  // them. Harmless to register unconditionally — it's a no-op read for the
  // real S3StorageProvider, which never calls getCurrentRequestOrigin().
  registerRequestOriginTracking(app);

  app.setErrorHandler((err: FastifyError | AppError, request, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send(errorBody(err));
    }

    // Fastify's own schema-validation errors carry a `validation` array.
    if (err.validation) {
      return reply.code(422).send({
        error: { code: "VALIDATION_ERROR", message: err.message, details: err.validation },
      });
    }

    // Other framework-level errors (e.g. FST_ERR_CTP_EMPTY_JSON_BODY when a
    // client sends Content-Type: application/json with no body, or a
    // malformed-JSON body) are genuine 4xx client errors, not server bugs —
    // surface the real status rather than flattening every non-AppError into
    // a generic 500 "Something went wrong", which hid the actual cause the
    // first time this happened (see the driver-web/admin-web apiRequest fix
    // for the client-side half of this).
    if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send({
        error: { code: err.code ?? "BAD_REQUEST", message: err.message },
      });
    }

    request.log.error(err);
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });

  await registerAuthRoutes(app);
  await registerAdminAuthRoutes(app);
  await registerIdentityRoutes(app);
  await registerAdminUserRoutes(app);
  await registerAdminModerationRoutes(app);
  await registerPropertyRoutes(app);
  await registerHostRoutes(app);
  await registerListingRoutes(app);
  await registerGeoRoutes(app);

  // Dev/CI-only: backs the mock StorageProvider's presigned URLs with real
  // local-disk PUT/GET so the upload flow is exercised for real rather than
  // stubbed. Structurally unreachable in production — env.ts refuses to boot
  // at all with STORAGE_PROVIDER=mock while NODE_ENV=production.
  if (env.STORAGE_PROVIDER === "mock") {
    await registerMockStorageRoutes(app);
  }

  return app;
}
