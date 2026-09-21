import { apiRequest } from "./client";

export interface Profile {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
  commPrefs: { push?: boolean; sms?: boolean; whatsapp?: boolean; email?: boolean } | null;
  status: string;
  onboardingWizardCompletedAt: string | null;
}

export function getProfile(): Promise<Profile> {
  return apiRequest("/v1/me/profile");
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  return apiRequest("/v1/me/profile", { method: "PATCH", body: input });
}
