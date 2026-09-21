import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { AppError, errorBody } from "./lib/errors.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerAdminAuthRoutes } from "./modules/admin-auth/routes.js";
import { registerIdentityRoutes } from "./modules/identity/routes.js";
import { registerAdminUserRoutes } from "./modules/admin/routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      transport: process.env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
    },
    trustProxy: true,
  });

  app.get("/healthz", async () => ({ status: "ok" }));

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

    request.log.error(err);
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });

  await registerAuthRoutes(app);
  await registerAdminAuthRoutes(app);
  await registerIdentityRoutes(app);
  await registerAdminUserRoutes(app);

  return app;
}
