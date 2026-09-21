import { Button, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestOtp } from "../api/auth";
import { ApiError } from "../api/client";
import type { AuthStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneEntry">;

/**
 * Deliberately sparse — no marketing carousel, no illustration competing
 * with the single task. The objective is explicitly "low-friction": this
 * screen should feel like five seconds, not a funnel.
 */
export function PhoneEntryScreen({ navigation }: Props) {
  const theme = useTheme();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      navigation.navigate("OtpEntry", { phone });
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setError("Too many attempts for this number — please try again in a little while.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.content}>
          <Text style={[styles.brand, { color: theme.colors.accent, fontFamily: theme.fonts.headingBold }]}>ParkAway</Text>
          <Text style={[styles.heading, { color: theme.colors.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
            Find guaranteed parking
          </Text>
          <Text style={[styles.subheading, { color: theme.colors.textSecondary, fontFamily: theme.fonts.body }]}>
            Enter your mobile number to continue
          </Text>

          <View style={styles.form}>
            {error && <InlineBanner variant="danger">{error}</InlineBanner>}
            <TextField
              label="Mobile number"
              keyboardType="phone-pad"
              placeholder="+91 98765 43210"
              value={phone}
              onChangeText={setPhone}
              autoFocus
            />
            <Button onPress={handleSubmit} fullWidth loading={loading} disabled={phone.length < 6}>
              Continue
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 8 },
  brand: { fontSize: 18, textAlign: "center", marginBottom: 24 },
  heading: { fontSize: 24, textAlign: "center" },
  subheading: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  form: { gap: 16, marginTop: 8 },
});
