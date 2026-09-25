import { Badge, Eyebrow, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getHostProfile, type HostProfile } from "../../api/hostProfile";
import { listOwnListings, type Listing } from "../../api/listings";
import { listProperties } from "../../api/properties";
import type { OwnerTabParamList } from "../../navigation/OwnerTabs";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";
import { PersonaSwitchPill } from "../../components/PersonaSwitchPill";

type Props = CompositeScreenProps<BottomTabScreenProps<OwnerTabParamList, "OwnerHome">, NativeStackScreenProps<OwnerStackParamList>>;

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

/**
 * Before onboarding is complete this is a checklist, not a dashboard —
 * modelled on the Airbnb host "what's required to get paid" pattern: what
 * blocks *publishing* (a property, a space) is separate from what blocks
 * *money* (payout details) — AC-5. Once a host has at least one listing,
 * it becomes the fuller earnings/listings dashboard from the design canvas
 * — the earnings figures and today's bookings there are mock (no booking
 * backend yet, see DriverSearchScreen's doc comment for the pattern); the
 * listings list itself is real.
 */
export function OwnerHomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [listings, setListings] = useState<Listing[]>([]);
  const [hasProperty, setHasProperty] = useState(false);
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      listOwnListings().then((r) => setListings(r.listings));
      listProperties().then((r) => setHasProperty(r.properties.length > 0));
      getHostProfile()
        .then(setHostProfile)
        .catch(() => setHostProfile(null));
    }, [])
  );

  const kycDone = hostProfile?.kycStatus === "verified";
  const payoutDone = Boolean(hostProfile?.payoutAccountLast4);
  const spaceDone = listings.length > 0;
  const stepsDone = [spaceDone, kycDone, payoutDone].filter(Boolean).length;

  function openListing(listing: Listing) {
    if (listing.status === "draft") {
      navigation.navigate("ListingWizard", { listingId: listing.id, step: "fit" });
    } else {
      navigation.navigate("OwnerListingDetail", { listingId: listing.id });
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.avatar, { backgroundColor: c.textPrimary }]}>
              <Text style={[styles.avatarLabel, { color: c.accentSoft, fontFamily: theme.fonts.headingSemibold }]}>
                {(hostProfile?.legalName ?? "H").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.hostName, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>
                {hostProfile?.legalName ?? "Your hosting account"}
              </Text>
              {kycDone && (
                <View style={styles.verifiedRow}>
                  <Ionicons name="shield-checkmark" size={10} color={c.success} />
                  <Text style={[styles.verifiedLabel, { color: c.success }]}>Verified host</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.headerIcons}>
            <IconButton accessibilityLabel="Notifications" badge>
              <Ionicons name="notifications-outline" size={16} color={c.textPrimary} />
            </IconButton>
            <IconButton accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={16} color={c.textPrimary} />
            </IconButton>
          </View>
        </View>

        <PersonaSwitchPill active="owner" />

        {spaceDone && (
          <View style={[styles.hero, { backgroundColor: c.textPrimary }]}>
            <View style={styles.heroTop}>
              <Eyebrow color={c.accentSoft}>Live spaces</Eyebrow>
              <TouchableOpacity style={styles.heroPayoutLink} onPress={() => navigation.navigate("Earnings")}>
                <Ionicons name="card-outline" size={12} color="#FFFFFF" />
                <Text style={styles.heroPayoutLabel}>Payouts</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.heroValue, { color: c.background, fontFamily: theme.fonts.headingSemibold }]}>
              {listings.filter((l) => l.status === "published").length}
            </Text>
            <Text style={[styles.heroHint, { color: "rgba(255,255,255,0.6)" }]}>
              Published and visible to drivers once search launches (Sprint 3).
            </Text>
          </View>
        )}

        {stepsDone < 3 && (
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <View style={styles.setupHeader}>
              <Eyebrow color={c.textMuted}>Setup · {stepsDone} of 3 done</Eyebrow>
              <Text style={[styles.setupPct, { color: c.accentHover }]}>{Math.round((stepsDone / 3) * 100)}%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: c.background }]}>
              <View style={[styles.progressFill, { width: `${(stepsDone / 3) * 100}%`, backgroundColor: c.accent }]} />
            </View>
            <ChecklistRow
              label="Add your space"
              done={spaceDone}
              onPress={() => (hasProperty ? navigation.navigate("Spaces") : navigation.navigate("PropertyForm"))}
            />
            <ChecklistRow label="Verify your identity" done={kycDone} onPress={() => navigation.navigate("HostKyc")} />
            <ChecklistRow label="Add payout details" done={payoutDone} onPress={() => navigation.navigate("HostPayout")} />
          </View>
        )}

        <View style={styles.quickActions}>
          <QuickAction
            icon="add"
            label="New listing"
            filled
            onPress={() => (hasProperty ? navigation.navigate("Spaces") : navigation.navigate("PropertyForm"))}
          />
          <QuickAction icon="pricetag-outline" label="Pricing" onPress={() => navigation.navigate("Spaces")} />
          <QuickAction icon="card-outline" label="Payouts" onPress={() => navigation.navigate("HostPayout")} />
          <QuickAction icon="person-outline" label="Profile" onPress={() => navigation.navigate("Profile")} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Eyebrow color={c.textMuted}>My spaces · {listings.length}</Eyebrow>
              <Text style={[styles.sectionTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Listings &amp; status</Text>
            </View>
            <TouchableOpacity onPress={() => (hasProperty ? navigation.navigate("PropertyForm") : navigation.navigate("PropertyForm"))}>
              <Text style={[styles.addLink, { color: c.accentHover }]}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {listings.length === 0 ? (
            <TouchableOpacity onPress={() => navigation.navigate("PropertyForm")}>
              <View style={[styles.emptyListing, { borderColor: c.borderStrong }]}>
                <Ionicons name="add-circle-outline" size={20} color={c.accent} />
                <Text style={[styles.emptyListingLabel, { color: c.textSecondary }]}>Add your first parking space</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              {listings.length > 2 && (
                <TouchableOpacity onPress={() => navigation.navigate("Spaces")} style={styles.seeAllRow}>
                  <Text style={[styles.seeAllLabel, { color: c.textSecondary }]}>
                    See all {listings.length} listings — draft, in review &amp; suspended too
                  </Text>
                  <Ionicons name="chevron-forward" size={12} color={c.textSecondary} />
                </TouchableOpacity>
              )}
              {listings.slice(0, 3).map((listing) => (
                <TouchableOpacity key={listing.id} onPress={() => openListing(listing)} activeOpacity={0.85}>
                  <View style={[styles.listingCard, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
                    <View style={styles.listingTop}>
                      <View style={[styles.listingThumb, { backgroundColor: c.surfaceRaised }]} />
                      <View style={styles.listingInfo}>
                        <View style={styles.listingBadgeRow}>
                          <Badge label={STATUS_LABEL[listing.status] ?? listing.status} variant={STATUS_VARIANT[listing.status] ?? "neutral"} />
                        </View>
                        <Text style={[styles.listingLabel, { color: c.textPrimary }]}>{listing.spaceLabel}</Text>
                        {listing.statusReason && <Text style={[styles.listingReason, { color: c.textMuted }]}>{listing.statusReason}</Text>}
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
          <Text style={[styles.reliabilityText, { color: c.textSecondary }]}>
            <Text style={{ color: c.textPrimary, fontWeight: "700" }}>Reliability 4.9</Text> · cancelling a confirmed booking lowers this and pauses
            payouts.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistRow({ label, done, onPress }: { label: string; done: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity onPress={onPress} style={styles.checklistRow} activeOpacity={0.7}>
      <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={16} color={done ? c.success : c.textMuted} />
      <Text style={[styles.checklistLabel, { color: done ? c.textMuted : c.textPrimary, textDecorationLine: done ? "line-through" : "none" }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, onPress, filled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; filled?: boolean }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.quickActionIcon, filled ? { backgroundColor: c.textPrimary } : { backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderStrong }]}>
        <Ionicons name={icon} size={19} color={filled ? c.background : c.textPrimary} />
      </View>
      <Text style={[styles.quickActionLabel, { color: c.textPrimary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 18, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  avatarLabel: { fontSize: 16 },
  hostName: { fontSize: 14.5 },
  verifiedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  verifiedLabel: { fontSize: 10.5, fontWeight: "700" },
  headerIcons: { flexDirection: "row", gap: 10 },
  hero: { borderRadius: 22, padding: 22, gap: 6 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroPayoutLink: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  heroPayoutLabel: { fontSize: 11.5, fontWeight: "700", color: "#FFFFFF" },
  heroValue: { fontSize: 38 },
  heroHint: { fontSize: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  setupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  setupPct: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%" },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checklistLabel: { fontSize: 12.5 },
  quickActions: { flexDirection: "row", justifyContent: "space-between" },
  quickAction: { alignItems: "center", gap: 7, flex: 1 },
  quickActionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  quickActionLabel: { fontSize: 10.5, fontWeight: "600", textAlign: "center" },
  section: { gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { fontSize: 19 },
  addLink: { fontSize: 12, fontWeight: "700" },
  seeAllRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  seeAllLabel: { fontSize: 12, fontWeight: "700" },
  emptyListing: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1.5, borderStyle: "dashed", borderRadius: 16, padding: 16 },
  emptyListingLabel: { fontSize: 12.5, fontWeight: "700" },
  listingCard: { borderWidth: 1, borderRadius: 18, padding: 14 },
  listingTop: { flexDirection: "row", gap: 14 },
  listingThumb: { width: 56, height: 56, borderRadius: 12 },
  listingInfo: { flex: 1, gap: 5 },
  listingBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  listingLabel: { fontSize: 14, fontWeight: "700" },
  listingReason: { fontSize: 11 },
  reliabilityText: { fontSize: 11.5, lineHeight: 17 },
});
