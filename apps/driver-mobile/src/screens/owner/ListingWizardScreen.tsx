import { Button, Card, Eyebrow, IconButton, InlineBanner, TextField, useTheme } from "@parkaway/ui-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../api/client";
import {
  completePhotoUpload,
  deletePhoto,
  getListing,
  listListingPhotos,
  requestPhotoUploadUrl,
  submitListing,
  updateListing,
  updatePhoto,
  type Listing,
  type ListingPhoto,
} from "../../api/listings";
import { previewPrice, setPricing } from "../../api/pricing";
import { LocationField, type LatLng } from "../../components/LocationField";
import { PhotoPicker } from "../../components/PhotoPicker";
import type { OwnerStackParamList } from "../../navigation/RootNavigator";

type Props = NativeStackScreenProps<OwnerStackParamList, "ListingWizard">;

const STEPS = ["fit", "photos", "access", "price", "review"] as const;
type Step = (typeof STEPS)[number];

const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"];
const ACCESS_METHODS = [
  { value: "open", label: "Open — no gate or check-in" },
  { value: "qr", label: "QR code at entry" },
  { value: "guard_manual", label: "Security guard checks the driver in" },
];

/**
 * Same short, explicitly-not-29-screen stepped flow as ui-web's
 * `ListingWizardScreen`, ported to native. Progress is a segmented bar
 * (matches the product's design canvas), not the soft dots the driver
 * onboarding wizard uses — this flow isn't freely skippable the way
 * onboarding is.
 */
export function ListingWizardScreen({ route, navigation }: Props) {
  const { listingId } = route.params;
  const theme = useTheme();
  const c = theme.colors;
  const [step, setStep] = useState<Step>((route.params.step as Step) ?? "fit");
  const [listing, setListing] = useState<Listing | null>(null);

  const refresh = useCallback(() => {
    getListing(listingId).then(setListing);
  }, [listingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!listing) return null;

  const currentIndex = STEPS.indexOf(step);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["left", "right", "bottom"]}>
      <View style={styles.header}>
        <IconButton accessibilityLabel="Back" onPress={() => (currentIndex === 0 ? navigation.goBack() : setStep(STEPS[currentIndex - 1]!))}>
          <Ionicons name="arrow-back" size={15} color={c.textPrimary} />
        </IconButton>
        <View style={styles.headerText}>
          <Text style={[styles.heading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>{listing.spaceLabel}</Text>
          <Text style={[styles.stepLabel, { color: c.textMuted }]}>
            Step {currentIndex + 1} of {STEPS.length} · Listing wizard
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("OwnerTabs")}>
          <Text style={[styles.saveExit, { color: c.textMuted }]}>Save &amp; exit</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.progressRow}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressSegment, { backgroundColor: i <= currentIndex ? c.accent : c.borderStrong }]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === "fit" && <FitStep listing={listing} onSaved={refresh} onNext={() => setStep("photos")} />}
        {step === "photos" && <PhotosStep listingId={listingId} onNext={() => setStep("access")} onBack={() => setStep("fit")} />}
        {step === "access" && <AccessStep listing={listing} onSaved={refresh} onNext={() => setStep("price")} onBack={() => setStep("photos")} />}
        {step === "price" && <PriceStep listingId={listingId} onNext={() => setStep("review")} onBack={() => setStep("access")} />}
        {step === "review" && (
          <ReviewStep
            listingId={listingId}
            listing={listing}
            onSubmitted={() => navigation.navigate("OwnerTabs")}
            onBack={() => setStep("price")}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FitStep({ listing, onSaved, onNext }: { listing: Listing; onSaved: () => void; onNext: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(listing.vehicleTypes ?? []);
  const [lengthCm, setLengthCm] = useState(listing.lengthCm ? String(listing.lengthCm) : "");
  const [widthCm, setWidthCm] = useState(listing.widthCm ? String(listing.widthCm) : "");
  const [heightCm, setHeightCm] = useState(listing.heightCm ? String(listing.heightCm) : "");
  const [covered, setCovered] = useState(listing.covered);
  const [location, setLocation] = useState<LatLng | null>(listing.locationLat !== undefined ? { lat: listing.locationLat, lng: listing.locationLng! } : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleType(t: string) {
    setVehicleTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      await updateListing(listing.id, {
        vehicleTypes,
        lengthCm: lengthCm ? Number(lengthCm) : undefined,
        widthCm: widthCm ? Number(widthCm) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        covered,
        ...(location ? { location } : {}),
      });
      onSaved();
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.step}>
      <Text style={[styles.stepHeading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>What fits here?</Text>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}

      <Card style={styles.stepCard}>
        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>Vehicle types</Text>
        <View style={styles.chipGroup}>
          {VEHICLE_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              onPress={() => toggleType(t)}
              style={[styles.chip, { borderColor: vehicleTypes.includes(t) ? c.textPrimary : c.borderStrong, backgroundColor: vehicleTypes.includes(t) ? c.textPrimary : c.surface }]}
            >
              <Text style={{ color: vehicleTypes.includes(t) ? c.background : c.textSecondary, fontSize: 13, fontWeight: "600" }}>{t[0]!.toUpperCase() + t.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.row}>
          <View style={styles.rowField}>
            <TextField label="Length (cm)" keyboardType="numeric" value={lengthCm} onChangeText={setLengthCm} />
          </View>
          <View style={styles.rowField}>
            <TextField label="Width (cm)" keyboardType="numeric" value={widthCm} onChangeText={setWidthCm} />
          </View>
          <View style={styles.rowField}>
            <TextField label="Height (cm)" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />
          </View>
        </View>

        <View style={[styles.switchRow, { borderColor: c.borderStrong }]}>
          <Text style={[styles.switchLabel, { color: c.textPrimary }]}>Covered / sheltered</Text>
          <Switch value={covered} onValueChange={setCovered} trackColor={{ true: c.success, false: c.border }} />
        </View>

        <LocationField label="Exact location of this space" value={location} onChange={setLocation} />
      </Card>

      <Button onPress={handleContinue} loading={loading} fullWidth>
        Continue
      </Button>
    </View>
  );
}

function PhotosStep({ listingId, onNext, onBack }: { listingId: string; onNext: () => void; onBack: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);

  const refresh = useCallback(() => {
    listListingPhotos(listingId).then((r) => setPhotos(r.photos));
  }, [listingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={styles.step}>
      <Text style={[styles.stepHeading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Photos</Text>
      <Text style={[styles.previewNote, { color: c.textMuted }]}>
        Verified listings get more bookings. Drivers see these before they arrive — clear photos mean fewer disputes.
      </Text>
      <PhotoPicker
        photos={photos.map((p) => ({ id: p.id, url: p.url, isCover: p.isCover }))}
        requestUploadUrl={async (contentType, byteSize) => {
          const result = await requestPhotoUploadUrl(listingId, contentType, byteSize);
          return { uploadId: result.photoId, uploadUrl: result.uploadUrl, requiredHeaders: result.requiredHeaders };
        }}
        completeUpload={async (photoId) => {
          await completePhotoUpload(listingId, photoId);
        }}
        onUploaded={refresh}
        onSetCover={async (photoId) => {
          await updatePhoto(listingId, photoId, { isCover: true });
          refresh();
        }}
        onDelete={async (photoId) => {
          await deletePhoto(listingId, photoId);
          refresh();
        }}
      />
      <View style={styles.actionsRow}>
        <Button variant="secondary" onPress={onBack}>
          Back
        </Button>
        <Button onPress={onNext}>Continue</Button>
      </View>
    </View>
  );
}

function AccessStep({ listing, onSaved, onNext, onBack }: { listing: Listing; onSaved: () => void; onNext: () => void; onBack: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [accessMethod, setAccessMethod] = useState(listing.accessMethod ?? "open");
  const [rules, setRules] = useState(listing.rules ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      await updateListing(listing.id, { accessMethod, rules });
      onSaved();
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.step}>
      <Text style={[styles.stepHeading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Access &amp; price</Text>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      <Card style={styles.stepCard}>
        <Text style={[styles.fieldLabel, { color: c.textMuted }]}>How does a driver get in?</Text>
        <View style={styles.chipGroupVertical}>
          {ACCESS_METHODS.map((m) => (
            <TouchableOpacity
              key={m.value}
              onPress={() => setAccessMethod(m.value)}
              style={[styles.methodRow, { borderColor: c.borderStrong, backgroundColor: accessMethod === m.value ? c.surfaceRaised : c.surface }]}
            >
              <View style={[styles.radio, { borderColor: accessMethod === m.value ? c.accent : c.borderStrong }]}>
                {accessMethod === m.value && <View style={[styles.radioDot, { backgroundColor: c.accent }]} />}
              </View>
              <Text style={{ color: c.textPrimary, fontSize: 14, flex: 1 }}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextField label="Rules or notes for drivers (optional)" value={rules} onChangeText={setRules} placeholder="e.g. Enter through the side gate" />
      </Card>
      <View style={styles.actionsRow}>
        <Button variant="secondary" onPress={onBack}>
          Back
        </Button>
        <Button onPress={handleContinue} loading={loading}>
          Continue
        </Button>
      </View>
    </View>
  );
}

function PriceStep({ listingId, onNext, onBack }: { listingId: string; onNext: () => void; onBack: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [hourlyRupees, setHourlyRupees] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewPrice>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    const paise = Math.round(Number(hourlyRupees) * 100);
    if (!paise || paise <= 0) {
      setError("Set an hourly rate before continuing.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await setPricing(listingId, [{ ruleType: "base_hourly", amountPaise: paise }]);
      const now = new Date();
      const later = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      setPreview(await previewPrice(listingId, now.toISOString(), later.toISOString()));
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save pricing — try again.");
    } finally {
      setLoading(false);
    }
  }

  const earnPerHour = hourlyRupees ? ((Number(hourlyRupees) * 0.85)).toFixed(0) : null;

  return (
    <View style={styles.step}>
      <Text style={[styles.stepHeading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Base price</Text>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      <Card style={styles.stepCard}>
        <Eyebrow color={c.textMuted}>Versioned — old bookings keep their rate</Eyebrow>
        <TextField label="Hourly rate (₹)" keyboardType="numeric" value={hourlyRupees} onChangeText={setHourlyRupees} placeholder="e.g. 40" />
        {earnPerHour && (
          <View style={[styles.earnBanner, { backgroundColor: c.successSoft }]}>
            <Text style={[styles.earnLabel, { color: c.success }]}>You earn per hour (after platform fee)</Text>
            <Text style={[styles.earnValue, { color: c.success, fontFamily: theme.fonts.headingSemibold }]}>₹{earnPerHour}</Text>
          </View>
        )}
        {preview && (
          <Text style={[styles.previewNote, { color: c.textSecondary }]}>
            2-hour sample quote: ₹{(preview.totalPaise / 100).toFixed(0)} total, you earn ₹{(preview.hostEarningsPaise / 100).toFixed(0)}
          </Text>
        )}
      </Card>
      <View style={styles.actionsRow}>
        <Button variant="secondary" onPress={onBack}>
          Back
        </Button>
        <Button onPress={handleContinue} loading={loading}>
          Continue
        </Button>
      </View>
    </View>
  );
}

export function ReviewStep({ listingId, listing, onSubmitted, onBack }: { listingId: string; listing: Listing; onSubmitted: () => void; onBack: () => void }) {
  const theme = useTheme();
  const c = theme.colors;
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const [failures, setFailures] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listListingPhotos(listingId).then((r) => setPhotoCount(r.photos.length));
  }, [listingId]);

  async function handleSubmit() {
    setError(null);
    setFailures(null);
    setLoading(true);
    try {
      await submitListing(listingId);
      onSubmitted();
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        const details = err.details as { failures?: string[] } | undefined;
        setFailures(details?.failures ?? [err.message]);
      } else {
        setError(err instanceof ApiError ? err.message : "Could not submit — try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.step}>
      <Text style={[styles.stepHeading, { color: c.textPrimary, fontFamily: theme.fonts.headingSemibold }]}>Review &amp; submit</Text>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      {failures && (
        <InlineBanner variant="danger">
          {"This listing isn't ready yet:\n" + failures.map((f) => `• ${f}`).join("\n")}
        </InlineBanner>
      )}
      <View style={[styles.reviewRow, { borderColor: c.borderStrong }]}>
        <Text style={[styles.reviewLabel, { color: c.textMuted }]}>Space</Text>
        <Text style={{ color: c.textPrimary }}>
          {listing.spaceLabel} — {listing.vehicleTypes?.join(", ") || "no vehicle types set"}
        </Text>
      </View>
      <View style={[styles.reviewRow, { borderColor: c.borderStrong }]}>
        <Text style={[styles.reviewLabel, { color: c.textMuted }]}>Photos</Text>
        <Text style={{ color: c.textPrimary }}>{photoCount ?? "…"} added</Text>
      </View>
      <View style={[styles.reviewRow, { borderColor: c.borderStrong }]}>
        <Text style={[styles.reviewLabel, { color: c.textMuted }]}>Access</Text>
        <Text style={{ color: c.textPrimary }}>{listing.accessMethod ?? "not set"}</Text>
      </View>
      {listing.status === "draft" ? (
        <>
          <Text style={[styles.previewNote, { color: c.textSecondary }]}>
            Submitting sends this for admin review. It won&apos;t be visible to drivers until approved.
          </Text>
          <View style={styles.actionsRow}>
            <Button variant="secondary" onPress={onBack}>
              Back
            </Button>
            <Button onPress={handleSubmit} loading={loading}>
              Submit for review
            </Button>
          </View>
        </>
      ) : (
        // Already submitted/published/etc. — submitting again would just
        // 409 ("not in draft"). This step still works as a read-only status
        // view; the fit/access/price steps stay editable via Back.
        <>
          <View style={[styles.reviewRow, { borderColor: c.borderStrong }]}>
            <Text style={[styles.reviewLabel, { color: c.textMuted }]}>Status</Text>
            <Text style={{ color: c.textPrimary, textTransform: "capitalize" }}>
              {listing.status.replace(/_/g, " ")}
              {listing.statusReason ? ` — ${listing.statusReason}` : ""}
            </Text>
          </View>
          <Button variant="secondary" onPress={onBack}>
            Back
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  headerText: { flex: 1, gap: 2 },
  heading: { fontSize: 19 },
  stepLabel: { fontSize: 12 },
  saveExit: { fontSize: 12, fontWeight: "700" },
  progressRow: { flexDirection: "row", gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
  progressSegment: { flex: 1, height: 4, borderRadius: 999 },
  content: { padding: 20, paddingTop: 4, gap: 16, paddingBottom: 48 },
  step: { gap: 16 },
  stepHeading: { fontSize: 18 },
  stepCard: { gap: 16 },
  fieldLabel: { fontSize: 12 },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipGroupVertical: { gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: "row", gap: 10 },
  rowField: { flex: 1 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 14, padding: 14 },
  switchLabel: { fontSize: 13.5, fontWeight: "700" },
  earnBanner: { borderRadius: 14, padding: 14, gap: 2 },
  methodRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  earnLabel: { fontSize: 11 },
  earnValue: { fontSize: 34 },
  previewNote: { fontSize: 12, lineHeight: 17 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  reviewLabel: { fontSize: 12, width: 70 },
});
