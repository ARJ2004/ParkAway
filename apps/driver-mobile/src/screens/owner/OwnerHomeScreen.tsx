import { Badge, Card, useTheme } from "@parkaway/ui-native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listOwnListings, type Listing } from "../../api/listings";
import { listProperties } from "../../api/properties";
import type { OwnerTabParamList } from "../../navigation/OwnerTabs";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";
import { PersonaSwitchPill } from "../../components/PersonaSwitchPill";

type Props = CompositeScreenProps<BottomTabScreenProps<OwnerTabParamList, "OwnerHome">, NativeStackScreenProps<OwnerStackParamList>>;

/**
 * Before onboarding is complete this is a checklist, not a dashboard —
 * modelled on the Airbnb host "what's required to get paid" pattern: what
 * blocks *publishing* (a property, a space) is separate from what blocks
 * *money* (payout details) — AC-5.
 */
export function OwnerHomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [listings, setListings] = useState<Listing[]>([]);
  const [hasProperty, setHasProperty] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listOwnListings().then((r) => setListings(r.listings));
      listProperties().then((r) => setHasProperty(r.properties.length > 0));
    }, [])
  );

  const publishedCount = listings.filter((l) => l.status === "published").length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <PersonaSwitchPill active="owner" />

        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Welcome, host</Text>

        {publishedCount > 0 && (
          <View style={[styles.hero, { backgroundColor: c.textPrimary }]}>
            <Text style={[styles.heroEyebrow, { color: c.accentSoft }]}>Live spaces</Text>
            <Text style={[styles.heroValue, { color: c.background, fontFamily: theme.fonts.headingSemibold }]}>{publishedCount}</Text>
            <Text style={[styles.heroHint, { color: "rgba(255,255,255,0.6)" }]}>
              Published and visible to drivers once search launches (Sprint 3).
            </Text>
          </View>
        )}

        <ChecklistItem
          title="Add your space"
          body="Register the property, then describe the parking space you're renting out."
          done={listings.length > 0}
          onPress={() => (hasProperty ? navigation.navigate("Spaces") : navigation.navigate("PropertyForm"))}
        />
        <ChecklistItem title="Verify your identity" body="Submit ID and ownership evidence — required to get paid, not required to publish." onPress={() => navigation.navigate("HostKyc")} />
        <ChecklistItem title="Add payout details" body="So you can receive earnings once bookings start." onPress={() => navigation.navigate("HostPayout")} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistItem({ title, body, done, onPress }: { title: string; body: string; done?: boolean; onPress: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Card>
      <TouchableOpacity onPress={onPress} style={styles.itemRow} activeOpacity={0.7}>
        <View style={styles.itemText}>
          <Text style={[styles.itemTitle, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>{title}</Text>
          <Text style={[styles.itemBody, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>{body}</Text>
        </View>
        <Badge label={done ? "Done" : "Start"} variant={done ? "success" : "neutral"} />
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  heading: { fontSize: 24 },
  hero: { borderRadius: 22, padding: 24, gap: 6 },
  heroEyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: "700" },
  heroValue: { fontSize: 42 },
  heroHint: { fontSize: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  itemText: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 15 },
  itemBody: { fontSize: 13 },
});
