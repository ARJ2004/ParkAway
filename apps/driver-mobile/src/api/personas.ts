import { apiRequest } from "./client";

export interface PersonasResponse {
  available: Array<"driver" | "owner">;
  granted: Array<"driver" | "host">;
  lastPersona: "driver" | "owner" | null;
}

export function getPersonas(): Promise<PersonasResponse> {
  return apiRequest("/v1/me/personas");
}

export function selectPersona(persona: "driver" | "owner"): Promise<PersonasResponse> {
  return apiRequest("/v1/me/personas/select", { method: "POST", body: { persona } });
}
