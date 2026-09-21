import { apiRequest } from "./client";

export interface VerifyOtpResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isNewUser: boolean;
  userId: string;
}

export function requestOtp(phone: string): Promise<{ status: string }> {
  return apiRequest("/v1/auth/otp/request", { method: "POST", body: { phone }, auth: false });
}

export function verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse> {
  return apiRequest("/v1/auth/otp/verify", { method: "POST", body: { phone, code }, auth: false });
}

export function logout(refreshToken: string): Promise<void> {
  return apiRequest("/v1/auth/logout", { method: "POST", body: { refreshToken }, auth: false });
}
