import { Badge, Button, Card, Eyebrow, IconButton, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/client";
import { completeDocumentUpload, createHostProfile, getHostProfile, requestDocumentUploadUrl, submitKyc, type HostProfile } from "../../api/hostProfile";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";

type Props = NativeStackScreenProps<OwnerStackParamList, "HostKyc">;

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
// Real KYC stages (host.kycStatus), not a made-up "level 1 of 4" like the
// design canvas's mockup — that 4-level scale belongs to LISTING
// verification (INV-02), a different real concept from host KYC.
const KYC_STAGE_INDEX: Record<string, number> = { not_started: 0, submitted: 1, rejected: 1, verified: 2 };
const KYC_STAGES = ["Start", "In review", "Verified"];

/** AC-5: KYC gates payout, not publication — reachable and completable independently of listing work. */
export function HostKycScreen({ navigation }: Props) {
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

  const header = (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Back" onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={15} color={c.textPrimary} />
      </IconButton>
      <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Verify to get paid</Text>
    </View>
  );

  const infoBanner = (
    <View style={[styles.infoCard, { backgroundColor: c.textPrimary }]}>
      <View style={styles.infoTitleRow}>
        <Ionicons name="information-circle-outline" size={15} color={c.accentSoft} />
        <Text style={styles.infoTitle}>Your listings stay live either way</Text>
      </View>
      <Text style={styles.infoBody}>
        Verification only unlocks payouts — it never affects whether drivers can find or book your spot.
      </Text>
    </View>
  );

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          {infoBanner}
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
  const stageIndex = KYC_STAGE_INDEX[profile.kycStatus] ?? 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {header}
        {infoBanner}
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}
        {profile.kycStatus === "rejected" && profile.kycRejectionReason && <InlineBanner variant="danger">{profile.kycRejectionReason}</InlineBanner>}

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Verification status</Text>
            <Badge label={status.label} variant={status.variant} />
          </View>
          <View style={styles.progressRow}>
            {KYC_STAGES.map((stage, i) => (
              <View key={stage} style={[styles.progressSegment, { backgroundColor: i <= stageIndex ? c.accent : c.borderStrong }]} />
            ))}
          </View>
        </View>

        {(profile.kycStatus === "not_started" || profile.kycStatus === "rejected") && (
          <Card style={styles.card}>
            <Eyebrow color={c.textMuted}>Document type</Eyebrow>
            <View style={styles.chipRow}>
              {DOC_TYPES.map((d) => (
                <TouchableOpacity
                  key={d.value}
                  onPress={() => setDocType(d.value)}
                  style={[styles.chip, { borderColor: docType === d.value ? c.textPrimary : c.borderStrong, backgroundColor: docType === d.value ? c.textPrimary : c.surface }]}
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
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { fontSize: 19 },
  infoCard: { borderRadius: 18, padding: 18, gap: 10 },
  infoTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoTitle: { fontSize: 12.5, fontWeight: "700", color: "#FFFFFF" },
  infoBody: { fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 17 },
  progressSection: { gap: 10 },
  progressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressTitle: { fontSize: 16 },
  progressRow: { flexDirection: "row", gap: 6 },
  progressSegment: { flex: 1, height: 5, borderRadius: 999 },
  card: { gap: 14 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
});
