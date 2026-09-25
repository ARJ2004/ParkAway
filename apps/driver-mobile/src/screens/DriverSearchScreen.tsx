import { Badge, Eyebrow, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { MainTabParamList } from "../navigation/MainTabs";
import type { AppStackParamList } from "../navigation/RootNavigator";

type Props = CompositeScreenProps<BottomTabScreenProps<MainTabParamList, "Search">, NativeStackScreenProps<AppStackParamList>>;

export interface MockSpot {
  id: string;
  name: string;
  locality: string;
  distanceKm: number;
  pricePerHour: number;
  rating: number | null;
  verified: boolean;
  openLabel: string;
  openNow: boolean;
  tags: string[];
  gradient: [string, string];
}

/**
 * `SRCH-*` hasn't landed (Sprint 3) — this is a visual preview built ahead of
 * that backend, on explicit direction, against fixed mock data rather than
 * `/v1/search`. Replace this with real results when Sprint 3 lands rather
 * than restyling around it again; the shape (`MockSpot`) mirrors what a real
 * search result is expected to return.
 */
export const MOCK_SPOTS: MockSpot[] = [
  {
    id: "spot-1",
    name: "Forum Courtyard — B2",
    locality: "Koramangala",
    distanceKm: 0.4,
    pricePerHour: 60,
    rating: 4.9,
    verified: true,
    openLabel: "Open now",
    openNow: true,
    tags: ["Covered", "CCTV", "EV", "Sedan+SUV"],
    gradient: ["#3a3630", "#161310"],
  },
  {
    id: "spot-2",
    name: "St. Johns Lit Lot — T2",
    locality: "Koramangala",
    distanceKm: 0.6,
    pricePerHour: 40,
    rating: 4.7,
    verified: true,
    openLabel: "Open now",
    openNow: true,
    tags: ["CCTV", "24×7", "Lit"],
    gradient: ["#5a4a2f", "#2a2015"],
  },
  {
    id: "spot-3",
    name: "Meera's Driveway — HSR",
    locality: "HSR Layout",
    distanceKm: 1.2,
    pricePerHour: 35,
    rating: 4.8,
    verified: true,
    openLabel: "Open now",
    openNow: true,
    tags: ["Covered", "Instant"],
    gradient: ["#2f3f5a", "#151c2a"],
  },
  {
    id: "spot-4",
    name: "Terrace Row — Slots 1–4",
    locality: "Koramangala",
    distanceKm: 1.8,
    pricePerHour: 40,
    rating: null,
    verified: true,
    openLabel: "Opens 6 AM",
    openNow: false,
    tags: ["24×7", "4 slots"],
    gradient: ["#4a4a44", "#232320"],
  },
];

const FILTERS = ["Today · 6:30–9:30 PM", "Verified", "Covered", "Under ₹50/hr", "EV charging"];

export function DriverSearchScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.safe, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back" onPress={() => navigation.navigate("Home")}>
            <Ionicons name="arrow-back" size={16} color={c.textPrimary} />
          </IconButton>
          <View style={styles.headerText}>
            <Eyebrow color={c.textMuted} style={styles.eyebrowSmall}>
              Destination
            </Eyebrow>
            <Text style={[styles.destination, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]} numberOfLines={1}>
              Phoenix Marketcity, Whitefield
            </Text>
          </View>
          <IconButton accessibilityLabel="Edit search">
            <Ionicons name="pencil" size={16} color={c.textPrimary} />
          </IconButton>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((filter, i) => (
            <View key={filter} style={[styles.chip, i === 0 ? { backgroundColor: c.textPrimary, borderColor: c.textPrimary } : { borderColor: c.borderStrong }]}>
              <Text style={[styles.chipLabel, { color: i === 0 ? c.background : c.textPrimary }]}>{filter}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.mapBand, { backgroundColor: c.surfaceRaised, borderColor: c.borderStrong }]}>
          <Ionicons name="map-outline" size={28} color={c.textMuted} />
          <Text style={[styles.mapNote, { color: c.textMuted }]}>Map view — pin-drop lands with real search (Sprint 3)</Text>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
            {MOCK_SPOTS.length} verified spots nearby
          </Text>
          <Text style={[styles.sortLabel, { color: c.textSecondary }]}>Sort: Nearest</Text>
        </View>

        <View style={styles.results}>
          {MOCK_SPOTS.map((spot) => (
            <TouchableOpacity key={spot.id} onPress={() => navigation.navigate("DriverSpotDetail", { spotId: spot.id })} activeOpacity={0.85}>
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderStrong, opacity: spot.openNow ? 1 : 0.6 }]}>
                <View style={styles.cardTop}>
                  <View style={[styles.thumb, { backgroundColor: spot.gradient[0] }]} />
                  <View style={styles.cardInfo}>
                    <View style={styles.metaRow}>
                      {spot.verified && (
                        <>
                          <Ionicons name="shield-checkmark" size={12} color={c.success} />
                          <Text style={[styles.metaText, { color: c.success }]}>Verified</Text>
                        </>
                      )}
                      {spot.rating && (
                        <>
                          <Text style={{ color: c.textMuted }}>·</Text>
                          <Ionicons name="star" size={11} color={c.accent} />
                          <Text style={[styles.metaText, { color: c.textMuted }]}>{spot.rating}</Text>
                        </>
                      )}
                    </View>
                    <Text style={[styles.spotName, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>{spot.name}</Text>
                    <Text style={[styles.spotLocality, { color: c.textMuted }]}>
                      {spot.distanceKm} km · {spot.locality}
                    </Text>
                  </View>
                  <View style={styles.priceCol}>
                    <Text style={[styles.price, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>
                      ₹{spot.pricePerHour}
                      <Text style={styles.priceUnit}>/hr</Text>
                    </Text>
                    <Text style={[styles.openLabel, { color: spot.openNow ? c.success : c.danger }]}>{spot.openLabel}</Text>
                  </View>
                </View>
                <View style={styles.tagRow}>
                  {spot.tags.map((tag) => (
                    <Badge key={tag} label={tag} variant="neutral" />
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingTop: 24, gap: 16, paddingBottom: 32 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 1 },
  eyebrowSmall: { fontSize: 10 },
  destination: { fontSize: 14.5 },
  filters: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 13 },
  chipLabel: { fontSize: 12, fontWeight: "600" },
  mapBand: { height: 140, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  mapNote: { fontSize: 12, textAlign: "center", paddingHorizontal: 24 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultsTitle: { fontSize: 18 },
  sortLabel: { fontSize: 12, fontWeight: "700" },
  results: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  cardTop: { flexDirection: "row", gap: 14 },
  thumb: { width: 68, height: 68, borderRadius: 12 },
  cardInfo: { flex: 1, gap: 4, minWidth: 0 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 11, fontWeight: "700" },
  spotName: { fontSize: 15 },
  spotLocality: { fontSize: 11.5 },
  priceCol: { alignItems: "flex-end", gap: 3 },
  price: { fontSize: 15 },
  priceUnit: { fontSize: 11, fontWeight: "600" },
  openLabel: { fontSize: 10.5 },
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
});
