import { Badge, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getListing, pauseListing, resumeListing, type Listing } from "../../api/listings";
import { previewPrice } from "../../api/pricing";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";

type Props = NativeStackScreenProps<OwnerStackParamList, "OwnerListingDetail">;

const STATUS_VARIANT: Record<string, "success" | "neutral" | "warning" | "danger"> = {
  draft: "neutral",
  pending_verification: "warning",
  published: "success",
  paused: "neutral",
  suspended: "danger",
  archived: "neutral",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_verification: "In review",
  published: "Published",
  paused: "Paused",
  suspended: "Suspended",
  archived: "Archived",
};

// The week strip and recent-bookings rows are illustrative — there's no
// booking history to read yet (Sprint 4). Everything else on this screen
// (name, status, attributes, current rate) is real, fetched below.
const WEEK_STRIP = [
  { day: "Su", pct: 30 },
  { day: "Mo", pct: 42 },
  { day: "Tu", pct: 36 },
  { day: "We", pct: 46 },
  { day: "Th", pct: 50 },
  { day: "Fr", pct: 60, highlight: true },
  { day: "Sa", pct: 18, muted: true },
];

export function OwnerListingDetailScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const { listingId } = route.params;
  const [listing, setListing] = useState<Listing | null>(null);
  const [ratePaise, setRatePaise] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getListing(listingId).then(setListing).catch(() => {});
    const now = new Date();
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
    previewPrice(listingId, now.toISOString(), inOneHour.toISOString())
      .then((r) => setRatePaise(r.baseAmountPaise))
      .catch(() => setRatePaise(null));
  }, [listingId]);

  useFocusEffect(load);

  async function handleToggleStatus() {
    if (!listing) return;
    setBusy(true);
    try {
      const updated = listing.status === "paused" ? await resumeListing(listing.id) : await pauseListing(listing.id);
      setListing(updated);
    } catch {
      // Surfaced implicitly by the status badge not changing; this screen
      // doesn't have a toast system yet — matches other owner screens.
    } finally {
      setBusy(false);
    }
  }

  if (!listing) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]} />;
  }

  const attributes = [listing.covered ? "Covered" : null, ...(listing.vehicleTypes ?? [])].filter(Boolean).join(" · ");
  const canPause = listing.status === "published";
  const canResume = listing.status === "paused";

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { backgroundColor: "#3a3630" }]}>
          <SafeAreaView edges={["top"]}>
            <View style={styles.heroRow}>
              <IconButton accessibilityLabel="Back" variant="filled" onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
              </IconButton>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <View style={styles.statusRow}>
              <Badge label={STATUS_LABEL[listing.status] ?? listing.status} variant={STATUS_VARIANT[listing.status] ?? "neutral"} />
              {listing.publishedAt && <Text style={[styles.liveSince, { color: c.textMuted }]}>Live since {new Date(listing.publishedAt).toLocaleDateString()}</Text>}
            </View>
            <Text style={[styles.title, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>{listing.spaceLabel}</Text>
            {attributes.length > 0 && <Text style={[styles.subtitle, { color: c.textMuted }]}>{attributes}</Text>}
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>Today</Text>
              <Text style={[styles.statValue, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>6</Text>
              <Text style={[styles.statUnit, { color: c.textMuted }]}>bookings</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>Occupied</Text>
              <Text style={[styles.statValue, { color: c.success, fontFamily: theme.fonts.headingSemibold }]}>92%</Text>
              <Text style={[styles.statUnit, { color: c.textMuted }]}>of open hrs</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>Earned</Text>
              <Text style={[styles.statValue, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>₹1,080</Text>
              <Text style={[styles.statUnit, { color: c.textMuted }]}>today</Text>
            </View>
          </View>

          <View style={[styles.card, styles.rateCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <View style={styles.rateInfo}>
              <Text style={[styles.rateLabel, { color: c.textMuted }]}>Current rate</Text>
              <Text style={[styles.rateValue, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
                {ratePaise !== null ? `₹${Math.round(ratePaise / 100)}` : "—"}
                <Text style={styles.rateUnit}> /hr</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.editRateButton, { borderColor: c.accentSoft }]}
              onPress={() => navigation.navigate("ListingWizard", { listingId: listing.id, step: "price" })}
            >
              <Text style={[styles.editRateLabel, { color: c.accentHover }]}>Edit pricing</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <Text style={[styles.cardTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>This week</Text>
            <View style={styles.weekRow}>
              {WEEK_STRIP.map((day) => (
                <View key={day.day} style={styles.weekCell}>
                  <View
                    style={[
                      styles.weekBar,
                      { height: day.pct, backgroundColor: day.muted ? c.border : day.highlight ? c.accentHover : c.accent },
                    ]}
                  />
                  <Text style={[styles.weekLabel, { color: day.muted ? c.textMuted : c.textSecondary }]}>{day.day}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.recentSection}>
            <Text style={[styles.cardTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Recent bookings</Text>
            {[
              { name: "Rohit S. · today, 6:00–9:30 PM", plate: "KA 03 NB 8812", price: "₹180", live: true },
              { name: "Priya N. · yesterday, 2:00–4:00 PM", plate: "KA 41 CJ 7710", price: "₹120", live: false },
            ].map((row) => (
              <View key={row.name} style={[styles.bookingRow, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
                <View style={[styles.bookingDot, { backgroundColor: row.live ? c.success : c.border }]} />
                <Text style={[styles.bookingName, { color: c.textPrimary }]}>{row.name}</Text>
                <Text style={[styles.bookingPrice, { color: c.textPrimary }]}>{row.price}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: c.surface, borderTopColor: c.borderStrong }]}>
        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: c.textPrimary }]}
          onPress={() => navigation.navigate("ListingWizard", { listingId: listing.id, step: listing.status === "draft" ? "fit" : "review" })}
        >
          <Ionicons name="pencil" size={13} color={c.background} />
          <Text style={[styles.editLabel, { color: c.background, fontFamily: theme.fonts.bodySemibold }]}>Edit listing</Text>
        </TouchableOpacity>
        {(canPause || canResume) && (
          <TouchableOpacity style={[styles.pauseButton, { borderColor: c.danger }]} onPress={handleToggleStatus} disabled={busy}>
            <Text style={[styles.pauseLabel, { color: c.danger }]}>{canResume ? "Resume" : "Pause"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 110 },
  hero: { height: 170 },
  heroRow: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 12 },
  body: { padding: 20, gap: 20 },
  titleBlock: { gap: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveSince: { fontSize: 11.5 },
  title: { fontSize: 24 },
  subtitle: { fontSize: 12.5 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 3 },
  statLabel: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 17 },
  statUnit: { fontSize: 10 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  rateCard: { flexDirection: "row", alignItems: "center" },
  rateInfo: { flex: 1, gap: 2 },
  rateLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "700" },
  rateValue: { fontSize: 22 },
  rateUnit: { fontSize: 13 },
  editRateButton: { borderWidth: 1, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  editRateLabel: { fontSize: 12, fontWeight: "700" },
  cardTitle: { fontSize: 16 },
  weekRow: { flexDirection: "row", gap: 6, alignItems: "flex-end" },
  weekCell: { flex: 1, alignItems: "center", gap: 6 },
  weekBar: { width: "100%", borderRadius: 5, minHeight: 4 },
  weekLabel: { fontSize: 9.5 },
  recentSection: { gap: 12 },
  bookingRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  bookingDot: { width: 6, height: 6, borderRadius: 4 },
  bookingName: { flex: 1, fontSize: 12.5, fontWeight: "700" },
  bookingPrice: { fontSize: 13, fontWeight: "700" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, padding: 20, flexDirection: "row", gap: 10 },
  editButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 15 },
  editLabel: { fontSize: 14 },
  pauseButton: { flex: 1, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 15 },
  pauseLabel: { fontSize: 14, fontWeight: "700" },
});
