const ACCESS_TOKEN_KEY = "parkaway.admin.accessToken";
const REFRESH_TOKEN_KEY = "parkaway.admin.refreshToken";
const ROLE_KEY = "parkaway.admin.role";

export type AdminRole = "platform_admin" | "support";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getRole(): AdminRole | null {
  return localStorage.getItem(ROLE_KEY) as AdminRole | null;
}

export function setSession(accessToken: string, refreshToken: string, role: AdminRole): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(ROLE_KEY, role);
}

export function updateTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null;
}
