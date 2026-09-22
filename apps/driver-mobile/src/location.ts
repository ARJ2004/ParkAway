import * as Location from "expo-location";

export type LocationPermissionState = "granted" | "denied" | "undetermined" | "unavailable";

/**
 * DRV-04 — location permission groundwork. This module is deliberately the
 * only thing DRV-04 delivers this sprint: real destination search (SRCH-01,
 * Sprint 3) is what will actually consume a position. The one rule that
 * matters now is that nothing here is ever a prerequisite for anything else
 * built this sprint — search-by-typed-destination must remain fully usable
 * with permission denied or unavailable.
 */

function mapStatus(status: Location.PermissionStatus): LocationPermissionState {
  switch (status) {
    case Location.PermissionStatus.GRANTED:
      return "granted";
    case Location.PermissionStatus.DENIED:
      return "denied";
    default:
      return "undetermined";
  }
}

/** Queries the CURRENT OS permission state without prompting — the OS is the source of truth, this is never cached client-side. */
export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return mapStatus(status);
  } catch {
    return "unavailable";
  }
}

/** Triggers the OS permission prompt. Call only after showing the soft-ask explanation — never at first app launch. */
export async function requestLocationPermission(): Promise<LocationPermissionState> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return mapStatus(status);
  } catch {
    return "unavailable";
  }
}

const UNRELIABLE_ACCURACY_METERS = 100;
const STALE_FIX_MS = 2 * 60 * 1000;

export interface SafePosition {
  latitude: number;
  longitude: number;
  /** False for a low-accuracy or stale fix — caller decides whether to use it for anything precision-sensitive; never a reason to block general use. */
  isReliable: boolean;
}

/** Returns null if permission isn't granted or the device can't produce a fix — callers must treat that as "fall back to manual entry," never as an error to surface. */
export async function getCurrentPositionSafe(): Promise<SafePosition | null> {
  const permission = await getLocationPermissionState();
  if (permission !== "granted") return null;

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const accuracy = position.coords.accuracy ?? Number.POSITIVE_INFINITY;
    const ageMs = Date.now() - position.timestamp;
    const isReliable = accuracy <= UNRELIABLE_ACCURACY_METERS && ageMs <= STALE_FIX_MS;

    return { latitude: position.coords.latitude, longitude: position.coords.longitude, isReliable };
  } catch {
    return null;
  }
}
