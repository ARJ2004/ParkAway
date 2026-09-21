import { apiRequest } from "./client";

export interface AdminUserSearchResult {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  status: "active" | "suspended";
  createdAt: string;
}

export function searchUsers(q: string): Promise<{ users: AdminUserSearchResult[] }> {
  return apiRequest(`/v1/admin/users?q=${encodeURIComponent(q)}`);
}

export function suspendUser(id: string, reason: string): Promise<{ id: string; status: string }> {
  return apiRequest(`/v1/admin/users/${id}/suspend`, { method: "POST", body: { reason } });
}

export function restoreUser(id: string, reason: string): Promise<{ id: string; status: string }> {
  return apiRequest(`/v1/admin/users/${id}/restore`, { method: "POST", body: { reason } });
}
