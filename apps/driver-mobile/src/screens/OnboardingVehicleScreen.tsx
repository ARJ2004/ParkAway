import { Button, InlineBanner, TextField, WizardProgress, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <WizardProgress total={2} currentIndex={1} />
        <Text style={[styles.heading, { color: theme.colors.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
          Add your vehicle
        </Text>
        <Text style={[styles.subheading, { color: theme.colors.textSecondary, fontFamily: theme.fonts.body }]}>
          Recommended — book faster next time. Skip anytime, add it later from your account.
        </Text>

        <View style={styles.form}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <TextField
            label="Registration number"
            value={registrationNo}
            onChangeText={setRegistrationNo}
            placeholder="MH12AB1234"
            autoCapitalize="characters"
          />
          <Text style={[styles.label, { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyMedium }]}>
            Vehicle type
          </Text>
          <View style={styles.chipRow}>
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
          </View>
          <View style={styles.actions}>
            <View style={styles.actionButton}>
              <Button variant="skip" onPress={wizardFinished} disabled={loading} fullWidth>
                Skip
              </Button>
            </View>
            <View style={styles.actionButton}>
              <Button onPress={handleFinish} loading={loading} fullWidth>
                Finish
              </Button>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 16 },
  heading: { fontSize: 24, textAlign: "center" },
  subheading: { fontSize: 14, textAlign: "center" },
  form: { gap: 16, marginTop: 8 },
  label: { fontSize: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  actions: { flexDirection: "row", gap: 12 },
  actionButton: { flex: 1 },
});
