import { Button, Card, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/client";
import { getHostProfile, setPayoutDetails } from "../../api/hostProfile";

/** Deliberately last and skippable — payout is "so you can get paid", never a gate on listing work. */
export function HostPayoutScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const [currentLast4, setCurrentLast4] = useState<string | null>(null);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getHostProfile()
        .then((p) => setCurrentLast4(p.payoutAccountLast4))
        .catch(() => {});
    }, [])
  );

  async function handleSave() {
    setError(null);
    setLoading(true);
    try {
      const result = await setPayoutDetails({ accountHolderName, bankName, ifsc, accountNumber });
      setCurrentLast4(result.last4);
      setAccountNumber("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your payout details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Payout details</Text>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}
        {saved && <InlineBanner variant="success">Saved.</InlineBanner>}
        {currentLast4 && <InlineBanner variant="success">{`Account on file, ending in ${currentLast4}.`}</InlineBanner>}
        <Card style={styles.card}>
          <TextField label="Account holder name" value={accountHolderName} onChangeText={setAccountHolderName} />
          <TextField label="Bank name" value={bankName} onChangeText={setBankName} />
          <TextField label="IFSC" value={ifsc} onChangeText={(t) => setIfsc(t.toUpperCase())} placeholder="HDFC0001234" autoCapitalize="characters" />
          <TextField label="Account number" value={accountNumber} onChangeText={setAccountNumber} keyboardType="numeric" placeholder={currentLast4 ? `•••• ${currentLast4}` : undefined} />
          <Text style={[styles.note, { color: c.textMuted }]}>
            Your account number is encrypted before storage and is never shown back to you or anyone else in full.
          </Text>
          <Button onPress={handleSave} loading={loading} disabled={!accountHolderName.trim() || !bankName.trim() || !ifsc.trim() || !accountNumber.trim()}>
            Save payout details
          </Button>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  heading: { fontSize: 22 },
  card: { gap: 14 },
  note: { fontSize: 11, lineHeight: 15 },
});
