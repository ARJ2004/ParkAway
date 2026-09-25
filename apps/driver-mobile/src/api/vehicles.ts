import { apiRequest } from "./client";

export interface Vehicle {
  id: string;
  userId: string;
  registrationNo: string;
  type: string;
  makeModel: string | null;
  isDefault: boolean;
  status: string;
  createdAt: string;
}

export function listVehicles(): Promise<{ vehicles: Vehicle[] }> {
  return apiRequest("/v1/me/vehicles");
}

export interface AddVehicleInput {
  registrationNo: string;
  type: string;
  makeModel?: string;
}

export function addVehicle(input: AddVehicleInput): Promise<Vehicle> {
  return apiRequest("/v1/me/vehicles", { method: "POST", body: input });
}

export function setDefaultVehicle(id: string): Promise<Vehicle> {
  return apiRequest(`/v1/me/vehicles/${id}`, { method: "PATCH", body: { isDefault: true } });
}

export function deactivateVehicle(id: string): Promise<Vehicle> {
  return apiRequest(`/v1/me/vehicles/${id}`, { method: "PATCH", body: { status: "inactive" } });
}

export interface UpdateVehicleInput {
  // Matches the backend's UpdateVehicleParams exactly (apps/api's
  // vehicle.service.ts) — registrationNo and type are immutable once added
  // (no route accepts changing them); remove and re-add to correct either.
  makeModel?: string;
  isDefault?: boolean;
}

export function updateVehicle(id: string, patch: UpdateVehicleInput): Promise<Vehicle> {
  return apiRequest(`/v1/me/vehicles/${id}`, { method: "PATCH", body: patch });
}
