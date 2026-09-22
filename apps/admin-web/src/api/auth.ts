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

export function adminLogout(refreshToken: string): Promise<void> {
  return apiRequest("/v1/admin/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
}
