import { Badge, Button, Card, EmptyState, useTheme } from "@parkaway/ui-native";
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

export function ListingListScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [listings, setListings] = useState<Listing[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [creating, setCreating] = useState(false);

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Your spaces</Text>
        <Button onPress={handleAddSpace} loading={creating}>
          + Add
        </Button>
      </View>

      {listings.length === 0 ? (
        <EmptyState title="No spaces yet" description="Add your first parking space to get started." />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate("ListingWizard", { listingId: item.id, step: item.status === "draft" ? "fit" : "review" })}
            >
              <Card style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={[styles.spaceLabel, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>{item.spaceLabel}</Text>
                  {item.statusReason && <Text style={[styles.reason, { color: c.textMuted }]}>{item.statusReason}</Text>}
                </View>
                <Badge label={STATUS_LABEL[item.status] ?? item.status} variant={STATUS_VARIANT[item.status] ?? "neutral"} />
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  heading: { fontSize: 22 },
  list: { paddingHorizontal: 20, gap: 12, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowText: { flex: 1, gap: 2 },
  spaceLabel: { fontSize: 15 },
  reason: { fontSize: 12 },
});
