import type { FastifyInstance } from "fastify";
import { db } from "../../db/client.js";
import { createOtpProvider } from "../../providers/otp/index.js";
import { requestOtp, verifyOtp } from "./otp.service.js";
import { revokeRefreshToken, rotateRefreshToken } from "./session.service.js";

const otpProvider = createOtpProvider();

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/v1/auth/otp/request",
    {
      schema: {
        body: {
          type: "object",
          required: ["phone"],
          properties: { phone: { type: "string", minLength: 6, maxLength: 20 } },
        },
      },
    },
    async (request, reply) => {
      const { phone } = request.body as { phone: string };
      await requestOtp(db, { phone, ip: request.ip, otpProvider });
      return reply.code(202).send({ status: "sent" });
    }
  );

  app.post(
    "/v1/auth/otp/verify",
    {
      schema: {
        body: {
          type: "object",
          required: ["phone", "code"],
          properties: {
            phone: { type: "string", minLength: 6, maxLength: 20 },
            code: { type: "string", minLength: 4, maxLength: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const { phone, code } = request.body as { phone: string; code: string };
      const deviceLabel = request.headers["user-agent"];
      const result = await verifyOtp(db, {
        phone,
        code,
        ip: request.ip,
        deviceLabel: typeof deviceLabel === "string" ? deviceLabel : undefined,
      });
      return reply.code(200).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.accessTokenExpiresIn,
        isNewUser: result.isNewUser,
        userId: result.userId,
      });
    }
  );

  app.post(
    "/v1/auth/refresh",
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

  app.post(
    "/v1/auth/logout",
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
      await revokeRefreshToken(db, refreshToken, request.ip);
      return reply.code(204).send();
    }
  );
}
