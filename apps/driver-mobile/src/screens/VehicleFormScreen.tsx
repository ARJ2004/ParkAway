import { Button, IconButton, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { addVehicle, deactivateVehicle, listVehicles, updateVehicle, type Vehicle } from "../api/vehicles";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AppStackParamList, "VehicleForm">;

const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"] as const;

export function VehicleFormScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const vehicleId = route.params?.vehicleId;
  const isEdit = Boolean(vehicleId);

  const [existing, setExisting] = useState<Vehicle | null>(null);
  const [registrationNo, setRegistrationNo] = useState("");
  const [type, setType] = useState<string>(VEHICLE_TYPES[0]);
  const [makeModel, setMakeModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicleId) return;
    listVehicles().then((res) => {
      const vehicle = res.vehicles.find((v) => v.id === vehicleId);
      if (vehicle) {
        setExisting(vehicle);
        setMakeModel(vehicle.makeModel ?? "");
      }
    });
  }, [vehicleId]);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (existing) {
        await updateVehicle(existing.id, { makeModel: makeModel || undefined });
      } else {
        await addVehicle({ registrationNo, type, makeModel: makeModel || undefined });
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this vehicle.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefault() {
    if (!existing || existing.isDefault) return;
    setLoading(true);
    try {
      const updated = await updateVehicle(existing.id, { isDefault: true });
      setExisting(updated);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    if (!existing) return;
    setLoading(true);
    try {
      await deactivateVehicle(existing.id);
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove this vehicle.");
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back" onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={15} color={c.textPrimary} />
          </IconButton>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
            {isEdit ? "Edit vehicle" : "Add a vehicle"}
          </Text>
        </View>

        <View style={styles.form}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}

          {existing ? (
            <>
              <View style={styles.readOnlyBlock}>
                <Text style={[styles.readOnlyLabel, { color: c.textMuted }]}>License plate</Text>
                <Text style={[styles.readOnlyValue, { color: c.textPrimary }]}>{existing.registrationNo}</Text>
              </View>
              <View style={styles.readOnlyBlock}>
                <Text style={[styles.readOnlyLabel, { color: c.textMuted }]}>Vehicle type</Text>
                <Text style={[styles.readOnlyValue, { color: c.textPrimary }]}>{existing.type[0]!.toUpperCase() + existing.type.slice(1)}</Text>
              </View>
              <Text style={[styles.immutableNote, { color: c.textMuted }]}>
                Plate and type can&apos;t be changed once added — remove and re-add if this was a mistake.
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.label, { color: c.textMuted }]}>Vehicle type</Text>
              <View style={styles.chipRow}>
                {VEHICLE_TYPES.map((t) => {
                  const selected = t === type;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={[styles.chip, { backgroundColor: selected ? c.textPrimary : c.surface, borderColor: selected ? c.textPrimary : c.borderStrong }]}
                    >
                      <Text style={{ color: selected ? c.background : c.textSecondary, fontFamily: theme.fonts.bodyMedium }}>
                        {t[0]!.toUpperCase() + t.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                label="License plate"
                value={registrationNo}
                onChangeText={setRegistrationNo}
                placeholder="MH12AB1234"
                autoCapitalize="characters"
                autoFocus
              />
            </>
          )}

          <TextField label="Make & model (optional)" value={makeModel} onChangeText={setMakeModel} placeholder="e.g. Maruti Swift" />

          {existing && (
            <View style={[styles.defaultRow, { borderColor: c.borderStrong }]}>
              <View style={styles.defaultText}>
                <Text style={[styles.defaultTitle, { color: c.textPrimary }]}>Set as default</Text>
                <Text style={[styles.defaultBody, { color: c.textMuted }]}>Pre-selected when you book a spot</Text>
              </View>
              <Switch
                value={existing.isDefault}
                onValueChange={handleSetDefault}
                disabled={existing.isDefault || loading}
                trackColor={{ true: c.success, false: c.border }}
              />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button onPress={handleSubmit} loading={loading} disabled={!existing && !registrationNo} fullWidth>
            {isEdit ? "Save changes" : "Add vehicle"}
          </Button>
          {existing && (
            <Text style={[styles.removeLink, { color: c.danger }]} onPress={handleRemove}>
              Remove vehicle
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 24, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { fontSize: 19 },
  form: { gap: 16 },
  label: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
  readOnlyBlock: { gap: 4 },
  readOnlyLabel: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  readOnlyValue: { fontSize: 15, fontWeight: "600" },
  immutableNote: { fontSize: 11.5, lineHeight: 16 },
  defaultRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 14, padding: 14 },
  defaultText: { gap: 2 },
  defaultTitle: { fontSize: 13.5, fontWeight: "700" },
  defaultBody: { fontSize: 11.5 },
  actions: { gap: 12 },
  removeLink: { textAlign: "center", fontSize: 13, fontWeight: "700", padding: 6 },
});
