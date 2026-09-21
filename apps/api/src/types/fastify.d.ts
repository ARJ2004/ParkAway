import "fastify";
import type { AdminRole } from "../modules/auth/session.service.js";

declare module "fastify" {
  interface FastifyRequest {
    driverAuth?: { userId: string; sessionVersion: number };
    adminAuth?: { adminId: string; role: AdminRole; sessionVersion: number };
  }
}
