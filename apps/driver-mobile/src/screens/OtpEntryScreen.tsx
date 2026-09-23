import { Button, InlineBanner, OtpInput, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { requestOtp, verifyOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../navigation/AuthContext";
import type { AuthStackParamList } from "../navigation/RootNavigator";
import { setSession } from "../session";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpEntry">;

const RESEND_COOLDOWN_SECONDS = 30;
// Must match the backend's OTP_LENGTH (apps/api/src/env.ts) — the length the
// OTP input actually collects, not an arbitrary guess (this exact mismatch
// bit the web app during manual testing: a 4-digit bypass code against a
// 6-digit OTP_LENGTH never matched what the UI collected).
const OTP_LENGTH = 6;

export function OtpEntryScreen({ route, navigation }: Props) {
  const { phone } = route.params;
  const theme = useTheme();
  const { login } = useAuth();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(submittedCode: string) {
    if (submittedCode.length !== OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const result = await verifyOtp(phone, submittedCode);
      await setSession(result.accessToken, result.refreshToken);
      // login() resolves persona state (RootNavigator then routes to the
      // persona picker on first login, or straight to the right persona's
      // stack on a return visit — see RootNavigator.tsx).
      await login(result.isNewUser);
    } catch (err) {
      if (err instanceof ApiError) {
        const messages: Record<string, string> = {
          OTP_INCORRECT: err.message,
          OTP_INVALIDATED: "Too many incorrect attempts. Request a new code below.",
          OTP_EXPIRED_OR_NOT_FOUND: "This code has expired. Request a new one below.",
          OTP_ALREADY_USED: "This code was already used. Request a new one below.",
          ACCOUNT_SUSPENDED: "This account has been suspended. Contact support for help.",
          RATE_LIMITED: "Too many attempts — please try again shortly.",
        };
        setError(messages[err.code] ?? err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    setCode("");
    try {
      await requestOtp(phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Could not resend the code — please try again shortly.");
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.heading, { color: theme.colors.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
          Enter the code
        </Text>
        <Text style={[styles.subheading, { color: theme.colors.textSecondary, fontFamily: theme.fonts.body }]}>
          We sent a code to {phone}
        </Text>

        <View style={styles.form}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} error={!!error} autoFocus />
          <Button onPress={() => handleVerify(code)} fullWidth loading={loading} disabled={code.length !== OTP_LENGTH}>
            Verify
          </Button>
          <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
            <Text style={[styles.link, { color: theme.colors.textSecondary }]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.link, { color: theme.colors.textSecondary }]}>Change number</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 8 },
  heading: { fontSize: 24, textAlign: "center" },
  subheading: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  form: { gap: 16, alignItems: "center" },
  link: { fontSize: 14, textDecorationLine: "underline", textAlign: "center" },
});
