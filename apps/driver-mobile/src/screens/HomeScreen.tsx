import { Badge, Card, Eyebrow, IconButton, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getProfile, type Profile } from "../api/profile";
import { listVehicles, type Vehicle } from "../api/vehicles";
import { getLocationPermissionState, requestLocationPermission, type LocationPermissionState } from "../location";
import { PersonaSwitchPill } from "../components/PersonaSwitchPill";
import { useAuth } from "../navigation/AuthContext";
import type { MainTabParamList } from "../navigation/MainTabs";

type Props = BottomTabScreenProps<MainTabParamList, "Home">;

/**
 * A real dashboard, not a placeholder block — greeting, a hero "where to"
 * card (routes into the Search tab's mock results — see DriverSearchScreen's
 * doc comment for why that's mock, not real, ahead of Sprint 3), a status
 * card for the driver's default vehicle, and the location soft-ask. Visual
 * language — dark hero card, eyebrow labels, hairline borders — matches the
 * product's own design canvas (2026-09 refresh).
 */
export function HomeScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const { selectPersona } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [defaultVehicle, setDefaultVehicle] = useState<Vehicle | null>(null);
  const [hasAnyVehicle, setHasAnyVehicle] = useState(false);
  const [locationState, setLocationState] = useState<LocationPermissionState | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [switchingToOwner, setSwitchingToOwner] = useState(false);

  async function handleBecomeOwner() {
    setSwitchingToOwner(true);
    try {
      await selectPersona("owner");
    } finally {
      setSwitchingToOwner(false);
    }
  }

  const load = useCallback(() => {
    getProfile().then(setProfile).catch(() => {});
    listVehicles().then((res) => {
      const active = res.vehicles.filter((v) => v.status === "active");
      setHasAnyVehicle(active.length > 0);
      setDefaultVehicle(active.find((v) => v.isDefault) ?? null);
    });
    // Re-check on every focus, not just once — the OS permission can change
    // in system settings independent of anything this screen does.
    getLocationPermissionState().then(setLocationState);
  }, []);

  useFocusEffect(load);

  async function handleEnableLocation() {
    setRequestingLocation(true);
    try {
      const result = await requestLocationPermission();
      setLocationState(result);
    } finally {
      setRequestingLocation(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Eyebrow color={c.textMuted} style={styles.greetingEyebrow}>
              Namaste
            </Eyebrow>
            <Text style={[styles.name, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
              {profile?.name?.split(" ")[0] ?? "there"}
            </Text>
          </View>
          <View style={styles.headerIcons}>
            <IconButton accessibilityLabel="Notifications" badge>
              <Ionicons name="notifications-outline" size={17} color={c.textPrimary} />
            </IconButton>
            <IconButton accessibilityLabel="Support" variant="filled">
              <Ionicons name="headset-outline" size={17} color={c.background} />
            </IconButton>
          </View>
        </View>

        <PersonaSwitchPill active="driver" />

        <View style={[styles.hero, { backgroundColor: c.textPrimary }]}>
          <View style={styles.heroTop}>
            <Eyebrow color={c.accentSoft}>01 — Where to</Eyebrow>
            <View style={styles.heroBadge}>
              <View style={styles.heroBadgeDot} />
              <Text style={styles.heroBadgeLabel}>No GPS needed</Text>
            </View>
          </View>
          <Text style={[styles.heroTitle, { fontFamily: theme.fonts.headingSemibold }]}>A spot is waiting for you.</Text>
          <Pressable style={styles.heroCta} onPress={() => navigation.navigate("Search")}>
            <Text style={[styles.heroCtaLabel, { color: c.accentContrast, fontFamily: theme.fonts.bodySemibold }]}>Find guaranteed parking</Text>
            <Ionicons name="arrow-forward" size={15} color={c.accentContrast} />
          </Pressable>
          <View style={styles.heroFootRow}>
            <Ionicons name="shield-checkmark-outline" size={13} color={c.accentSoft} />
            <Text style={styles.heroFootNote}>Booked means guaranteed. Never &ldquo;maybe available.&rdquo;</Text>
          </View>
        </View>

        {locationState === "undetermined" && (
          <Card style={styles.locationCard}>
            <Ionicons name="location-outline" size={20} color={c.textSecondary} />
            <View style={styles.vehicleInfo}>
              <Text style={[styles.locationTitle, { color: c.textPrimary, fontFamily: theme.fonts.bodySemibold }]}>
                Allow location?
              </Text>
              <Text style={[styles.locationBody, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>
                Shows parking near you once search is live — search still works without it.
              </Text>
            </View>
            <Pressable onPress={handleEnableLocation} disabled={requestingLocation}>
              <Text style={[styles.locationAction, { color: c.accent, fontFamily: theme.fonts.bodySemibold }]}>
                {requestingLocation ? "…" : "Enable"}
              </Text>
            </Pressable>
          </Card>
        )}

        <Text style={[styles.sectionLabel, { color: c.textMuted, fontFamily: theme.fonts.bodyMedium }]}>
          Your vehicle
        </Text>

        {defaultVehicle ? (
          <Pressable onPress={() => navigation.navigate("Vehicles")}>
            <Card style={styles.vehicleCard}>
              <View style={[styles.vehicleIconWrap, { backgroundColor: c.accentSoft }]}>
                <Ionicons name="car-sport" size={22} color={c.accent} />
              </View>
              <View style={styles.vehicleInfo}>
                <Text style={[styles.vehiclePlate, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
                  {defaultVehicle.registrationNo}
                </Text>
                <Text style={[styles.vehicleMeta, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>
                  {defaultVehicle.type}
                  {defaultVehicle.makeModel ? ` · ${defaultVehicle.makeModel}` : ""}
                </Text>
              </View>
              <Badge label="Default" variant="success" />
            </Card>
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate("Vehicles")}>
            <Card style={styles.emptyVehicleCard}>
              <Ionicons name="add-circle-outline" size={22} color={c.accent} />
              <View style={styles.vehicleInfo}>
                <Text style={[styles.vehiclePlate, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
                  {hasAnyVehicle ? "No default vehicle set" : "Add your first vehicle"}
                </Text>
                <Text style={[styles.vehicleMeta, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>
                  {hasAnyVehicle ? "Pick one from the Garage tab" : "Book faster once search is live"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </Card>
          </Pressable>
        )}

        <Pressable onPress={handleBecomeOwner} disabled={switchingToOwner}>
          <Card style={[styles.upsellCard, { backgroundColor: c.surfaceRaised, borderColor: c.accentSoft }]}>
            <View style={[styles.upsellIconWrap, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="business-outline" size={20} color={c.accentHover} />
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={[styles.upsellTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Own a spot? Start earning.</Text>
              <Text style={[styles.vehicleMeta, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>List it in a few minutes — switch to Owner.</Text>
            </View>
            {switchingToOwner ? <ActivityIndicator color={c.accent} /> : <Ionicons name="chevron-forward" size={18} color={c.textMuted} />}
          </Card>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 22, gap: 20 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greetingEyebrow: { fontSize: 10, letterSpacing: 1.2, marginBottom: 2 },
  name: { fontSize: 24 },
  headerIcons: { flexDirection: "row", gap: 10 },
  hero: { borderRadius: 22, padding: 24, gap: 16 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#7FA98C" },
  heroBadgeLabel: { fontSize: 11, color: "#DBE4DC" },
  heroTitle: { fontSize: 26, color: "#FFFFFF", lineHeight: 32 },
  heroCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#C2703F", borderRadius: 12, paddingVertical: 16 },
  heroCtaLabel: { fontSize: 15 },
  heroFootRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroFootNote: { fontSize: 11.5, color: "rgba(255,255,255,0.72)", flex: 1 },
  locationCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  locationTitle: { fontSize: 14 },
  locationBody: { fontSize: 12, lineHeight: 16 },
  locationAction: { fontSize: 13 },
  sectionLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  vehicleCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  emptyVehicleCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  vehicleIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vehicleInfo: { flex: 1, gap: 2 },
  vehiclePlate: { fontSize: 16, letterSpacing: 0.3 },
  vehicleMeta: { fontSize: 13 },
  upsellCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1 },
  upsellIconWrap: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  upsellTitle: { fontSize: 15 },
});
