import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { rotateRefreshToken } from "../auth/session.service.js";
import { adminLogin } from "./service.js";

export async function registerAdminAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/admin/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body as { email: string; password: string };
      const result = await adminLogin(db, { email, password, ip: request.ip });
      return reply.code(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.accessTokenExpiresIn,
        adminId: result.adminId,
        role: result.role,
      });
    }
  );

  app.post(
    "/v1/admin/auth/refresh",
    {
      schema: {
        body: {
          type: "object",
          required: ["refreshToken"],
          properties: { refreshToken: { type: "string", minLength: 10 } },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken: string };
      const result = await rotateRefreshToken(db, refreshToken, request.ip);
      return reply.code(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.accessTokenExpiresIn,
      });
    }
  );
}
