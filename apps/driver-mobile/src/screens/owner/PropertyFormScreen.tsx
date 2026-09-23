import { Button, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/client";
import { createProperty, type LatLng } from "../../api/properties";
import { LocationField } from "../../components/LocationField";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";

type Props = NativeStackScreenProps<OwnerStackParamList, "PropertyForm">;

const PROPERTY_TYPES = [
  { value: "independent_home", label: "My home / driveway" },
  { value: "standalone", label: "A standalone commercial space I own" },
];

/**
 * The reduced, owner-persona version of property creation — no
 * authorization step, since `independent_home`/`standalone` properties are
 * self-authorized in the same transaction as creation (locked decision 4).
 */
export function PropertyFormScreen({ navigation }: Props) {
  const theme = useTheme();
  const c = theme.colors;
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]!.value);
  const [name, setName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [outsidersAllowed, setOutsidersAllowed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!name.trim() || !addressLine1.trim() || !locality.trim() || !city.trim() || !state.trim() || !pincode.trim() || !location) {
      setError("Fill in the property's name, address and location before continuing.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createProperty({
        name,
        propertyType,
        addressLine1,
        locality,
        city,
        state,
        pincode,
        location,
        entryLocation: location,
        outsiderPolicy: outsidersAllowed ? "allowed" : "disallowed",
      });
      navigation.replace("OwnerTabs");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the property — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Add a property</Text>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}

        <View style={styles.chipRow}>
          {PROPERTY_TYPES.map((t) => (
            <Text
              key={t.value}
              onPress={() => setPropertyType(t.value)}
              style={[
                styles.chip,
                { borderColor: c.border, backgroundColor: propertyType === t.value ? c.textPrimary : c.surface, color: propertyType === t.value ? c.background : c.textSecondary },
              ]}
            >
              {t.label}
            </Text>
          ))}
        </View>

        <TextField label="Property name" value={name} onChangeText={setName} placeholder="e.g. My driveway" />
        <TextField label="Address" value={addressLine1} onChangeText={setAddressLine1} placeholder="House / building, street" />
        <TextField label="Locality" value={locality} onChangeText={setLocality} />
        <View style={styles.row}>
          <View style={styles.rowField}>
            <TextField label="City" value={city} onChangeText={setCity} />
          </View>
          <View style={styles.rowField}>
            <TextField label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="numeric" />
          </View>
        </View>
        <TextField label="State" value={state} onChangeText={setState} />

        <LocationField label="Location" value={location} onChange={setLocation} hint="Tap 'Use my current location' or enter coordinates directly." />

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: c.textPrimary, fontFamily: theme.fonts.bodyMedium }]}>Allow anyone to book this space</Text>
            <Text style={[styles.switchHint, { color: c.textMuted }]}>Turn off if only people you&apos;ve personally authorized should see or book it.</Text>
          </View>
          <Switch value={outsidersAllowed} onValueChange={setOutsidersAllowed} trackColor={{ true: c.accent }} />
        </View>

        <Button onPress={handleSubmit} loading={loading} fullWidth>
          Save property
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  heading: { fontSize: 22 },
  chipRow: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 14, fontWeight: "600", overflow: "hidden" },
  row: { flexDirection: "row", gap: 12 },
  rowField: { flex: 1 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 14 },
  switchHint: { fontSize: 12 },
});
