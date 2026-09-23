import { TextField, useTheme } from "@parkaway/ui-native";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getCurrentPositionSafe, getLocationPermissionState, requestLocationPermission } from "../location";

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * No `MAPBOX_TOKEN` is provisioned yet (tech-stack.md §12) — this is
 * coordinate entry backed by the device's own GPS, not a visual pin-drop
 * map, mirroring ui-web's `MapPicker` for the same reason. A real map
 * (`@rnmapbox/maps`) is a drop-in replacement behind the same
 * `onChange(LatLng)` contract once a token exists.
 */
export function LocationField({ label, value, onChange, hint }: { label: string; value: LatLng | null; onChange: (v: LatLng) => void; hint?: string }) {
  const theme = useTheme();
  const c = theme.colors;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUseMyLocation() {
    setError(null);
    setLoading(true);
    try {
      let state = await getLocationPermissionState();
      if (state === "undetermined") {
        state = await requestLocationPermission();
      }
      if (state !== "granted") {
        setError("Location permission denied — enter coordinates manually below.");
        return;
      }
      const position = await getCurrentPositionSafe();
      if (!position) {
        setError("Couldn't get your location — enter coordinates manually below.");
        return;
      }
      onChange({ lat: position.latitude, lng: position.longitude });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: c.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.coordField}>
          <TextField
            keyboardType="numeric"
            placeholder="Latitude"
            value={value?.lat !== undefined ? String(value.lat) : ""}
            onChangeText={(t) => onChange({ lat: Number(t) || 0, lng: value?.lng ?? 0 })}
          />
        </View>
        <View style={styles.coordField}>
          <TextField
            keyboardType="numeric"
            placeholder="Longitude"
            value={value?.lng !== undefined ? String(value.lng) : ""}
            onChangeText={(t) => onChange({ lat: value?.lat ?? 0, lng: Number(t) || 0 })}
          />
        </View>
      </View>
      <TouchableOpacity onPress={handleUseMyLocation} disabled={loading}>
        <Text style={[styles.link, { color: c.accent, fontFamily: theme.fonts.bodyMedium }]}>{loading ? "Locating…" : "Use my current location"}</Text>
      </TouchableOpacity>
      {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
      {!error && hint && <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  label: { fontSize: 13 },
  row: { flexDirection: "row", gap: 10 },
  coordField: { flex: 1 },
  link: { fontSize: 13 },
  error: { fontSize: 12 },
  hint: { fontSize: 12 },
});
