import { Badge, Card, useTheme } from "@parkaway/ui-native";
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
 * A real dashboard, not a placeholder block — greeting, a status card for
 * the driver's default vehicle (or a CTA to add one), and the "search is
 * coming" message framed as a highlight card rather than apologetic filler
 * text. Pattern draws on Shell/Waymo's "one clear highlight card" home
 * layout and BMW's status-card treatment, restyled in ParkAway's own warm
 * palette — see Mobbin references consulted for this redesign.
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
        <PersonaSwitchPill active="driver" />

        <View>
          <Text style={[styles.greeting, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>
            {profile?.name ? `Hi ${profile.name.split(" ")[0]}` : "Hi there"}
          </Text>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingBold }]}>
            Guaranteed parking, on the way
          </Text>
        </View>

        <Card style={[styles.highlightCard, { backgroundColor: c.accentSoft, borderColor: "transparent" }]}>
          <Ionicons name="search-outline" size={22} color={c.accent} />
          <Text style={[styles.highlightTitle, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>
            Search &amp; booking are coming
          </Text>
          <Text style={[styles.highlightBody, { color: c.textSecondary, fontFamily: theme.fonts.body }]}>
            Destination-aware search lands soon. Your account is ready — add a vehicle now so booking is one tap
            when it arrives.
          </Text>
        </Card>

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
                  {hasAnyVehicle ? "Pick one from the Vehicles tab" : "Book faster once search is live"}
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
  content: { padding: 24, gap: 20 },
  greeting: { fontSize: 14 },
  heading: { fontSize: 26, marginTop: 2 },
  highlightCard: { gap: 8, borderWidth: 1 },
  highlightTitle: { fontSize: 17 },
  highlightBody: { fontSize: 14, lineHeight: 20 },
  sectionLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },
  vehicleCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  emptyVehicleCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  vehicleIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  vehicleInfo: { flex: 1, gap: 2 },
  vehiclePlate: { fontSize: 16, letterSpacing: 0.3 },
  vehicleMeta: { fontSize: 13 },
  locationCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  locationTitle: { fontSize: 14 },
  locationBody: { fontSize: 12, lineHeight: 16 },
  locationAction: { fontSize: 13 },
  upsellCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1 },
  upsellIconWrap: { width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  upsellTitle: { fontSize: 15 },
});
