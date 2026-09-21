import { Button, Card, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { addVehicle } from "../api/vehicles";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AppStackParamList, "VehicleForm">;

const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"] as const;

export function VehicleFormScreen({ navigation }: Props) {
  const theme = useTheme();
  const [registrationNo, setRegistrationNo] = useState("");
  const [type, setType] = useState<string>(VEHICLE_TYPES[0]);
  const [makeModel, setMakeModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await addVehicle({ registrationNo, type, makeModel: makeModel || undefined });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add this vehicle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <TextField
            label="Registration number"
            value={registrationNo}
            onChangeText={setRegistrationNo}
            placeholder="MH12AB1234"
            autoCapitalize="characters"
            autoFocus
          />
          <Text style={[styles.label, { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>
            Vehicle type
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {VEHICLE_TYPES.map((t) => {
              const selected = t === type;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surface,
                      borderColor: selected ? theme.colors.accent : theme.colors.borderStrong,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? theme.colors.accent : theme.colors.textSecondary,
                      fontFamily: theme.fonts.bodyMedium,
                    }}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <TextField
            label="Make & model (optional)"
            value={makeModel}
            onChangeText={setMakeModel}
            placeholder="e.g. Maruti Swift"
          />
          <Button onPress={handleSubmit} loading={loading} disabled={!registrationNo}>
            Add vehicle
          </Button>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 24 },
  card: { gap: 16 },
  label: { fontSize: 14 },
  chipRow: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
});
