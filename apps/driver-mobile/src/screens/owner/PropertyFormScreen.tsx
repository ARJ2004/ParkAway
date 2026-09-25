import { Eyebrow, IconButton, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/client";
import { createListing } from "../../api/listings";
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
 * Saving immediately creates a first (draft) listing under it and opens the
 * wizard — "Save & add a space" is literal, not just copy.
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
      const property = await createProperty({
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
      const listing = await createListing({ propertyId: property.id, spaceLabel: name });
      navigation.replace("ListingWizard", { listingId: listing.id, step: "fit" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the property — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top", "left", "right", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton accessibilityLabel="Back" onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={15} color={c.textPrimary} />
          </IconButton>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Add a property</Text>
        </View>

        <Text style={[styles.intro, { color: c.textMuted }]}>
          A property is the address itself — a home, a gated community, a lot. You&apos;ll add individual parking spaces to it next.
        </Text>

        {error && <InlineBanner variant="danger">{error}</InlineBanner>}

        <View style={styles.section}>
          <Eyebrow color={c.textMuted}>Property type</Eyebrow>
          <View style={styles.chipRow}>
            {PROPERTY_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                onPress={() => setPropertyType(t.value)}
                style={[styles.chip, { borderColor: propertyType === t.value ? c.textPrimary : c.borderStrong, backgroundColor: propertyType === t.value ? c.textPrimary : c.surface }]}
              >
                <Text style={[styles.chipLabel, { color: propertyType === t.value ? c.background : c.textSecondary }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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

        <View style={[styles.switchRow, { borderColor: c.borderStrong }]}>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: c.textPrimary }]}>Allow anyone to book this space</Text>
            <Text style={[styles.switchHint, { color: c.textMuted }]}>Turn off if only people you&apos;ve personally authorized should see or book it.</Text>
          </View>
          <Switch value={outsidersAllowed} onValueChange={setOutsidersAllowed} trackColor={{ true: c.success, false: c.border }} />
        </View>

        <TouchableOpacity onPress={handleSubmit} disabled={loading} style={[styles.submitButton, { backgroundColor: c.textPrimary }]}>
          {loading ? (
            <ActivityIndicator color={c.background} />
          ) : (
            <>
              <Text style={[styles.submitLabel, { color: c.background }]}>Save &amp; add a space</Text>
              <Ionicons name="arrow-forward" size={14} color={c.background} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { fontSize: 19 },
  intro: { fontSize: 13, lineHeight: 19, marginTop: -4 },
  section: { gap: 10 },
  chipRow: { flexDirection: "row", gap: 10 },
  chip: { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 12 },
  chipLabel: { fontSize: 12.5, fontWeight: "700" },
  row: { flexDirection: "row", gap: 12 },
  rowField: { flex: 1 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 13.5, fontWeight: "700" },
  switchHint: { fontSize: 11.5, lineHeight: 16 },
  submitButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 16 },
  submitLabel: { fontSize: 15, fontWeight: "700" },
});
