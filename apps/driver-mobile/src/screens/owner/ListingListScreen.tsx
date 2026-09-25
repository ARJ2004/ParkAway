import { Badge, EmptyState, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createListing, listOwnListings, type Listing } from "../../api/listings";
import { listProperties, type Property } from "../../api/properties";
import type { OwnerTabParamList } from "../../navigation/OwnerTabs";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";

type Props = CompositeScreenProps<BottomTabScreenProps<OwnerTabParamList, "Spaces">, NativeStackScreenProps<OwnerStackParamList>>;

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
  published: "Live",
  paused: "Paused",
  suspended: "Suspended",
  archived: "Archived",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Live" },
  { key: "pending_verification", label: "Needs action" },
  { key: "paused", label: "Inactive" },
] as const;

export function ListingListScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [listings, setListings] = useState<Listing[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const refresh = useCallback(() => {
    listOwnListings().then((r) => setListings(r.listings));
    listProperties().then((r) => setProperties(r.properties));
  }, []);

  useFocusEffect(refresh);

  async function handleAddSpace() {
    if (properties.length === 0) {
      navigation.navigate("PropertyForm");
      return;
    }
    setCreating(true);
    try {
      const listing = await createListing({ propertyId: properties[0]!.id, spaceLabel: "New space" });
      navigation.navigate("ListingWizard", { listingId: listing.id, step: "fit" });
    } finally {
      setCreating(false);
    }
  }

  function openListing(listing: Listing) {
    if (listing.status === "draft") {
      navigation.navigate("ListingWizard", { listingId: listing.id, step: "fit" });
    } else {
      navigation.navigate("OwnerListingDetail", { listingId: listing.id });
    }
  }

  const filtered = listings.filter((l) => {
    if (filter === "all") return true;
    if (filter === "paused") return l.status === "paused" || l.status === "archived" || l.status === "suspended";
    return l.status === filter;
  });
  const counts = {
    all: listings.length,
    published: listings.filter((l) => l.status === "published").length,
    pending_verification: listings.filter((l) => l.status === "pending_verification" || l.status === "draft").length,
    paused: listings.filter((l) => l.status === "paused" || l.status === "archived" || l.status === "suspended").length,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => navigation.navigate("OwnerHome")}>
          <Ionicons name="arrow-back" size={15} color={c.textPrimary} />
        </IconButton>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Your listings</Text>
        <IconButton accessibilityLabel="Add listing" variant="filled" onPress={handleAddSpace}>
          {creating ? null : <Ionicons name="add" size={17} color={c.background} />}
        </IconButton>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={FILTERS}
        keyExtractor={(f) => f.key}
        contentContainerStyle={styles.filterRow}
        style={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setFilter(item.key)}
            style={[styles.filterChip, filter === item.key ? { backgroundColor: c.textPrimary, borderColor: c.textPrimary } : { borderColor: c.borderStrong }]}
          >
            <Text style={[styles.filterLabel, { color: filter === item.key ? c.background : c.textPrimary }]}>
              {item.label} · {counts[item.key]}
            </Text>
          </TouchableOpacity>
        )}
      />

      {filtered.length === 0 ? (
        <EmptyState title="No listings here" description="Nothing matches this filter yet." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openListing(item)} activeOpacity={0.85}>
              <View style={[styles.row, { backgroundColor: c.surface, borderColor: item.status === "suspended" ? c.danger : c.borderStrong }]}>
                <View style={[styles.thumb, { backgroundColor: c.surfaceRaised }]} />
                <View style={styles.rowText}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.spaceLabel, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]} numberOfLines={1}>
                      {item.spaceLabel}
                    </Text>
                    <Badge label={STATUS_LABEL[item.status] ?? item.status} variant={STATUS_VARIANT[item.status] ?? "neutral"} />
                  </View>
                  {item.statusReason ? (
                    <Text style={[styles.reason, { color: item.status === "suspended" ? c.danger : c.textMuted }]}>{item.statusReason}</Text>
                  ) : (
                    <Text style={[styles.reason, { color: c.textMuted }]}>
                      {item.status === "draft" ? "Continue setup" : item.status === "pending_verification" ? "Under verification · usually 24–48h" : " "}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  heading: { flex: 1, fontSize: 19 },
  filterList: { flexGrow: 0 },
  filterRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  filterChip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  filterLabel: { fontSize: 12, fontWeight: "700" },
  list: { paddingHorizontal: 20, gap: 12, paddingBottom: 40 },
  row: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 18, padding: 14 },
  thumb: { width: 58, height: 58, borderRadius: 12 },
  rowText: { flex: 1, gap: 5, justifyContent: "center" },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  spaceLabel: { flex: 1, fontSize: 14 },
  reason: { fontSize: 11.5 },
});
