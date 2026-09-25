import { Button, Eyebrow, InlineBanner, TextField, WizardProgress, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../api/client";
import { addVehicle } from "../api/vehicles";
import { useAuth } from "../navigation/AuthContext";
import type { OnboardingStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<OnboardingStackParamList, "OnboardingVehicle">;

const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"] as const;

// `route`/`navigation` are unused here — this screen finishes the wizard via
// AuthContext's `wizardFinished()`, which flips RootNavigator to the app
// stack, rather than navigating directly.
export function OnboardingVehicleScreen(_props: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const { wizardFinished } = useAuth();
  const [registrationNo, setRegistrationNo] = useState("");
  const [type, setType] = useState<string>(VEHICLE_TYPES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    if (!registrationNo) {
      wizardFinished();
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await addVehicle({ registrationNo, type });
      wizardFinished();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your vehicle — you can add this later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <View style={styles.content}>
        <View style={styles.progressRow}>
          <WizardProgress total={2} currentIndex={1} />
          <TouchableOpacity onPress={wizardFinished} disabled={loading}>
            <Text style={[styles.skipLabel, { color: c.textMuted }]}>Skip</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <View style={styles.heading}>
            <Eyebrow color={c.accentHover}>Step 2 of 2</Eyebrow>
            <Text style={[styles.title, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Add your vehicle</Text>
            <Text style={[styles.subheading, { color: c.textMuted }]}>
              Hosts and gate staff use this to confirm it&apos;s you. You can add more later from Garage.
            </Text>
          </View>

          {error && <InlineBanner variant="danger">{error}</InlineBanner>}

          <View style={styles.typeBlock}>
            <Text style={[styles.label, { color: c.textMuted }]}>Vehicle type</Text>
            <View style={styles.chipRow}>
              {VEHICLE_TYPES.map((t) => {
                const selected = t === type;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.chip,
                      { backgroundColor: selected ? c.textPrimary : c.surface, borderColor: selected ? c.textPrimary : c.borderStrong },
                    ]}
                  >
                    <Text style={{ color: selected ? c.background : c.textSecondary, fontFamily: theme.fonts.bodyMedium }}>
                      {t[0]!.toUpperCase() + t.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <TextField
            label="License plate"
            value={registrationNo}
            onChangeText={setRegistrationNo}
            placeholder="MH12AB1234"
            autoCapitalize="characters"
          />
        </View>

        <Button onPress={handleFinish} loading={loading} fullWidth>
          Finish setup
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20, justifyContent: "space-between" },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skipLabel: { fontSize: 13, fontWeight: "700" },
  form: { gap: 20 },
  heading: { gap: 8 },
  title: { fontSize: 27, lineHeight: 33 },
  subheading: { fontSize: 13.5, lineHeight: 20 },
  typeBlock: { gap: 10 },
  label: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 16 },
});
