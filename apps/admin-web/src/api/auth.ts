import { apiRequest } from "./client";
import type { AdminRole } from "../session";

export interface AdminLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  adminId: string;
  role: AdminRole;
}

export function adminLogin(email: string, password: string): Promise<AdminLoginResponse> {
  return apiRequest("/v1/admin/auth/login", { method: "POST", body: { email, password }, auth: false });
}
