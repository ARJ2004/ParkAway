import { Badge, Button, Card, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/client";
import { completeDocumentUpload, createHostProfile, getHostProfile, requestDocumentUploadUrl, submitKyc, type HostProfile } from "../../api/hostProfile";

const DOC_TYPES = [
  { value: "pan", label: "PAN card" },
  { value: "aadhaar", label: "Aadhaar" },
  { value: "ownership_proof", label: "Ownership / authorization proof" },
];

const KYC_LABEL: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  not_started: { label: "Not started", variant: "neutral" },
  submitted: { label: "In review", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

/** AC-5: KYC gates payout, not publication — reachable and completable independently of listing work. */
export function HostKycScreen() {
  const theme = useTheme();
  const c = theme.colors;
  const [profile, setProfile] = useState<HostProfile | null | "loading">("loading");
  const [legalName, setLegalName] = useState("");
  const [docType, setDocType] = useState(DOC_TYPES[0]!.value);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    getHostProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  useFocusEffect(refresh);

  async function handleCreateProfile() {
    setError(null);
    setBusy(true);
    try {
      const created = await createHostProfile({ hostType: "individual", legalName });
      setProfile(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create your host profile.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUploadDocument() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library permission denied.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? "image/jpeg";

    setBusy(true);
    try {
      const { documentId, uploadUrl, requiredHeaders } = await requestDocumentUploadUrl({ docType, contentType, byteSize: asset.fileSize ?? 1_000_000 });
      const blob = await (await fetch(asset.uri)).blob();
      const putRes = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: blob });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      await completeDocumentUpload(documentId);
      setUploadedDocId(documentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitKyc() {
    setError(null);
    setBusy(true);
    try {
      const updated = await submitKyc();
      setProfile(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit for review.");
    } finally {
      setBusy(false);
    }
  }

  if (profile === "loading") return null;

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Verify your identity</Text>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <Card style={styles.card}>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>Create your host profile to start KYC — this doesn&apos;t block publishing a listing (AC-5).</Text>
            <TextField label="Legal name (as on your ID)" value={legalName} onChangeText={setLegalName} />
            <Button onPress={handleCreateProfile} loading={busy} disabled={!legalName.trim()}>
              Start
            </Button>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const status = KYC_LABEL[profile.kycStatus] ?? KYC_LABEL.not_started!;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Verify your identity</Text>
          <Badge label={status.label} variant={status.variant} />
        </View>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}
        {profile.kycStatus === "rejected" && profile.kycRejectionReason && <InlineBanner variant="danger">{profile.kycRejectionReason}</InlineBanner>}

        {(profile.kycStatus === "not_started" || profile.kycStatus === "rejected") && (
          <Card style={styles.card}>
            <Text style={{ color: c.textSecondary, fontSize: 13 }}>Document type</Text>
            <View style={styles.chipRow}>
              {DOC_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  onPress={() => setDocType(d.value)}
                  style={[styles.chip, { borderColor: c.border, backgroundColor: docType === d.value ? c.textPrimary : c.surface }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: docType === d.value ? c.background : c.textSecondary }}>{d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button variant="secondary" onPress={handleUploadDocument} loading={busy}>
              {uploadedDocId ? "Document uploaded — upload another" : "Upload document"}
            </Button>
            <Button onPress={handleSubmitKyc} loading={busy} disabled={!uploadedDocId}>
              Submit for review
            </Button>
          </Card>
        )}
        {profile.kycStatus === "submitted" && (
          <Card style={styles.card}>
            <Text style={{ color: c.textSecondary }}>We&apos;re reviewing your documents — this usually takes 1-2 business days.</Text>
          </Card>
        )}
        {profile.kycStatus === "verified" && (
          <Card style={styles.card}>
            <Text style={{ color: c.textSecondary }}>You&apos;re verified. Add your payout details to get paid.</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heading: { fontSize: 22 },
  card: { gap: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
