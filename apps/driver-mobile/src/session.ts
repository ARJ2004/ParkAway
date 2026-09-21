import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "parkaway_driver_access_token";
const REFRESH_TOKEN_KEY = "parkaway_driver_refresh_token";

// expo-secure-store, not AsyncStorage — tokens are encrypted at rest via the
// platform keystore/keychain rather than sitting in plain, unencrypted
// storage (docs.expo.dev/versions/v57.0.0/sdk/securestore/). Both tokens are
// well under its ~2048-byte practical limit.

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function setSession(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken), SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken)]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]);
}
