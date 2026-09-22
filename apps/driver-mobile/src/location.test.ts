import { describe, expect, it, vi, beforeEach } from "vitest";

const getForegroundPermissionsAsync = vi.fn();
const requestForegroundPermissionsAsync = vi.fn();
const getCurrentPositionAsync = vi.fn();

vi.mock("expo-location", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: (...args: unknown[]) => getForegroundPermissionsAsync(...args),
  requestForegroundPermissionsAsync: (...args: unknown[]) => requestForegroundPermissionsAsync(...args),
  getCurrentPositionAsync: (...args: unknown[]) => getCurrentPositionAsync(...args),
}));

const { getLocationPermissionState, requestLocationPermission, getCurrentPositionSafe } = await import(
  "./location"
);

beforeEach(() => {
  getForegroundPermissionsAsync.mockReset();
  requestForegroundPermissionsAsync.mockReset();
  getCurrentPositionAsync.mockReset();
});

describe("getLocationPermissionState", () => {
  it("maps granted/denied through, and any other OS status to undetermined", async () => {
    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    await expect(getLocationPermissionState()).resolves.toBe("granted");

    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
    await expect(getLocationPermissionState()).resolves.toBe("denied");

    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" });
    await expect(getLocationPermissionState()).resolves.toBe("undetermined");
  });

  it("returns 'unavailable' rather than throwing when the OS call rejects", async () => {
    getForegroundPermissionsAsync.mockRejectedValueOnce(new Error("no location services"));
    await expect(getLocationPermissionState()).resolves.toBe("unavailable");
  });
});

describe("requestLocationPermission", () => {
  it("returns the resulting status after prompting", async () => {
    requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
    await expect(requestLocationPermission()).resolves.toBe("denied");
  });

  it("returns 'unavailable' rather than throwing when the prompt itself fails", async () => {
    requestForegroundPermissionsAsync.mockRejectedValueOnce(new Error("prompt failed"));
    await expect(requestLocationPermission()).resolves.toBe("unavailable");
  });
});

describe("getCurrentPositionSafe", () => {
  it("returns null without calling getCurrentPositionAsync when permission isn't granted", async () => {
    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
    await expect(getCurrentPositionSafe()).resolves.toBeNull();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("marks a fresh, high-accuracy fix as reliable", async () => {
    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 12.9, longitude: 77.6, accuracy: 20 },
      timestamp: Date.now(),
    });

    await expect(getCurrentPositionSafe()).resolves.toEqual({
      latitude: 12.9,
      longitude: 77.6,
      isReliable: true,
    });
  });

  it("marks a low-accuracy fix (>100m) as unreliable, but still returns coordinates", async () => {
    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 12.9, longitude: 77.6, accuracy: 500 },
      timestamp: Date.now(),
    });

    await expect(getCurrentPositionSafe()).resolves.toEqual({
      latitude: 12.9,
      longitude: 77.6,
      isReliable: false,
    });
  });

  it("marks a stale fix (>2 minutes old) as unreliable", async () => {
    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 12.9, longitude: 77.6, accuracy: 10 },
      timestamp: Date.now() - 3 * 60 * 1000,
    });

    const result = await getCurrentPositionSafe();
    expect(result?.isReliable).toBe(false);
  });

  it("treats a missing accuracy value as unreliable rather than crashing", async () => {
    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { latitude: 12.9, longitude: 77.6, accuracy: null },
      timestamp: Date.now(),
    });

    const result = await getCurrentPositionSafe();
    expect(result?.isReliable).toBe(false);
  });

  it("returns null rather than throwing when the device can't produce a fix", async () => {
    getForegroundPermissionsAsync.mockResolvedValueOnce({ status: "granted" });
    getCurrentPositionAsync.mockRejectedValueOnce(new Error("timeout"));

    await expect(getCurrentPositionSafe()).resolves.toBeNull();
  });
});
