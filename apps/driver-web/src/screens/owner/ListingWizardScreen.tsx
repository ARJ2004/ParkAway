import { Button, InlineBanner, MapPicker, MoneyField, PhotoManager, Select, TextField, Toggle, WizardProgress } from "@parkaway/ui-web";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  type LatLng,
  type Listing,
} from "../../api/listings";
import { previewPrice, setPricing } from "../../api/pricing";
import { OwnerAppShell } from "../../components/OwnerAppShell";
import styles from "./ListingWizardScreen.module.css";

const STEPS = ["fit", "photos", "access", "price", "review"] as const;
type Step = (typeof STEPS)[number];

const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"];
const ACCESS_METHODS = [
  { value: "open", label: "Open — no gate or check-in" },
  { value: "qr", label: "QR code at entry" },
  { value: "guard_manual", label: "Security guard checks the driver in" },
];

/**
 * A short, explicitly-not-Airbnb's-29-screen stepped flow (§3.1's design
 * research note) — "Save & exit" on every step, a progress bar, and the
 * price step showing "you earn" alongside the driver-facing price.
 */
export function ListingWizardScreen() {
  const { id, step } = useParams<{ id: string; step: Step }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentStep: Step = STEPS.includes(step as Step) ? (step as Step) : "fit";
  const currentIndex = STEPS.indexOf(currentStep);

  const { data: listing } = useQuery({ queryKey: ["listing", id], queryFn: () => getListing(id!), enabled: !!id });

  function goTo(next: Step) {
    navigate(`/owner/listings/${id}/edit/${next}`);
  }
  function saveAndExit() {
    navigate("/owner/listings");
  }

  if (!listing) return null;

  return (
    <OwnerAppShell>
      <div className={styles.page}>
        <div className={styles.stepHeader}>
          <h1>{listing.spaceLabel}</h1>
          <button type="button" onClick={saveAndExit} style={{ background: "none", border: "none", color: "var(--color-text-secondary)", cursor: "pointer" }}>
            Save &amp; exit
          </button>
        </div>
        <WizardProgress total={STEPS.length} currentIndex={currentIndex} />

        {currentStep === "fit" && <FitStep listingId={id!} initial={listing} onNext={() => goTo("photos")} />}
        {currentStep === "photos" && <PhotosStep listingId={id!} onNext={() => goTo("access")} onBack={() => goTo("fit")} />}
        {currentStep === "access" && <AccessStep listingId={id!} initial={listing} onNext={() => goTo("price")} onBack={() => goTo("photos")} />}
        {currentStep === "price" && <PriceStep listingId={id!} onNext={() => goTo("review")} onBack={() => goTo("access")} />}
        {currentStep === "review" && (
          <ReviewStep
            listingId={id!}
            onSubmitted={() => {
              queryClient.invalidateQueries({ queryKey: ["ownListings"] });
              navigate("/owner/listings");
            }}
            onBack={() => goTo("price")}
          />
        )}
      </div>
    </OwnerAppShell>
  );
}

function FitStep({ listingId, initial, onNext }: { listingId: string; initial: Listing; onNext: () => void }) {
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(initial.vehicleTypes ?? []);
  const [lengthCm, setLengthCm] = useState(initial.lengthCm ? String(initial.lengthCm) : "");
  const [widthCm, setWidthCm] = useState(initial.widthCm ? String(initial.widthCm) : "");
  const [heightCm, setHeightCm] = useState(initial.heightCm ? String(initial.heightCm) : "");
  const [covered, setCovered] = useState(initial.covered ?? false);
  const [location, setLocation] = useState<LatLng | null>(initial.locationLat !== undefined ? { lat: initial.locationLat!, lng: initial.locationLng! } : null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleType(type: string) {
    setVehicleTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      await updateListing(listingId, {
        vehicleTypes,
        lengthCm: lengthCm ? Number(lengthCm) : undefined,
        widthCm: widthCm ? Number(widthCm) : undefined,
        heightCm: heightCm ? Number(heightCm) : undefined,
        covered,
        ...(location ? { location } : {}),
      });
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.form}>
      <h2>What fits here?</h2>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      <div>
        <span style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>Vehicle types</span>
        <div className={styles.checkGroup} style={{ marginTop: "6px" }}>
          {VEHICLE_TYPES.map((t) => (
            <button key={t} type="button" className={`${styles.checkChip} ${vehicleTypes.includes(t) ? styles.checkChipActive : ""}`} onClick={() => toggleType(t)}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <TextField label="Length (cm)" type="number" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} />
        <TextField label="Width (cm)" type="number" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} />
        <TextField label="Height (cm)" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
      </div>
      <Toggle label="Covered / sheltered" checked={covered} onChange={setCovered} />
      <MapPicker label="Exact location of this space" value={location} onChange={setLocation} hint="Usually the same as the property, unless the space is at a different spot within it." />
      <div className={styles.actions}>
        <span />
        <Button onClick={handleContinue} loading={loading}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function PhotosStep({ listingId, onNext, onBack }: { listingId: string; onNext: () => void; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["listingPhotos", listingId], queryFn: () => listListingPhotos(listingId) });
  const photos = data?.photos ?? [];

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["listingPhotos", listingId] });
  }

  return (
    <div className={styles.form}>
      <h2>Photos</h2>
      <PhotoManager
        photos={photos.map((p) => ({ id: p.id, url: p.url, isCover: p.isCover }))}
        requestUploadUrl={async (file) => {
          const result = await requestPhotoUploadUrl(listingId, file.type, file.size);
          return { uploadId: result.photoId, uploadUrl: result.uploadUrl, requiredHeaders: result.requiredHeaders };
        }}
        completeUpload={async (photoId) => {
          await completePhotoUpload(listingId, photoId);
        }}
        onUploaded={refetch}
        onSetCover={async (photoId) => {
          await updatePhoto(listingId, photoId, { isCover: true });
          refetch();
        }}
        onMove={async (photoId, direction) => {
          const index = photos.findIndex((p) => p.id === photoId);
          const targetIndex = direction === "left" ? index - 1 : index + 1;
          const target = photos[targetIndex];
          if (!target) return;
          await Promise.all([updatePhoto(listingId, photoId, { position: target.position }), updatePhoto(listingId, target.id, { position: photos[index]!.position })]);
          refetch();
        }}
        onDelete={async (photoId) => {
          await deletePhoto(listingId, photoId);
          refetch();
        }}
      />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}

function AccessStep({ listingId, initial, onNext, onBack }: { listingId: string; initial: Listing; onNext: () => void; onBack: () => void }) {
  const [accessMethod, setAccessMethod] = useState(initial.accessMethod ?? "open");
  const [rules, setRules] = useState(initial.rules ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    setError(null);
    setLoading(true);
    try {
      await updateListing(listingId, { accessMethod, rules });
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.form}>
      <h2>How does a driver get in?</h2>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      <Select label="Access method" options={ACCESS_METHODS} value={accessMethod} onChange={(e) => setAccessMethod(e.target.value)} />
      <TextField label="Rules or notes for drivers (optional)" value={rules} onChange={(e) => setRules(e.target.value)} placeholder="e.g. Enter through the side gate" />
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} loading={loading}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function PriceStep({ listingId, onNext, onBack }: { listingId: string; onNext: () => void; onBack: () => void }) {
  const [hourlyPaise, setHourlyPaise] = useState<number | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewPrice>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleContinue() {
    if (hourlyPaise === null) {
      setError("Set an hourly rate before continuing.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await setPricing(listingId, [{ ruleType: "base_hourly", amountPaise: hourlyPaise }]);
      const now = new Date();
      const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const breakdown = await previewPrice(listingId, now.toISOString(), twoHoursLater.toISOString());
      setPreview(breakdown);
      onNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save pricing — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.form}>
      <h2>Set your price</h2>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      <MoneyField label="Hourly rate" valuePaise={hourlyPaise} onChange={setHourlyPaise} hint="What a driver pays per hour." />
      {hourlyPaise !== null && (
        <div className={styles.earnPreview}>
          <span className={styles.earnLabel}>You earn per hour (after platform fee)</span>
          <span className={styles.earnValue}>₹{((hourlyPaise * 0.85) / 100).toFixed(0)}</span>
        </div>
      )}
      {preview && (
        <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
          2-hour sample quote: ₹{(preview.totalPaise / 100).toFixed(0)} total, you earn ₹{(preview.hostEarningsPaise / 100).toFixed(0)}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleContinue} loading={loading}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function ReviewStep({ listingId, onSubmitted, onBack }: { listingId: string; onSubmitted: () => void; onBack: () => void }) {
  const { data: listing } = useQuery({ queryKey: ["listing", listingId], queryFn: () => getListing(listingId) });
  const { data: photosData } = useQuery({ queryKey: ["listingPhotos", listingId], queryFn: () => listListingPhotos(listingId) });
  const [failures, setFailures] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        setError(err instanceof ApiError ? err.message : "Could not submit — please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (!listing) return null;

  return (
    <div className={styles.form}>
      <h2>Review &amp; submit</h2>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      {failures && (
        <InlineBanner variant="danger">
          <strong>This listing isn&apos;t ready yet:</strong>
          <ul className={styles.failures}>
            {failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </InlineBanner>
      )}
      <div className={styles.reviewSection}>
        <span className={styles.reviewLabel}>Space</span>
        <span>{listing.spaceLabel} — {listing.vehicleTypes?.join(", ") || "no vehicle types set"}</span>
      </div>
      <div className={styles.reviewSection}>
        <span className={styles.reviewLabel}>Photos</span>
        <span>{photosData?.photos.length ?? 0} added</span>
      </div>
      <div className={styles.reviewSection}>
        <span className={styles.reviewLabel}>Access</span>
        <span>{listing.accessMethod ?? "not set"}</span>
      </div>
      <p style={{ fontSize: "13px", color: "var(--color-text-secondary)" }}>
        Submitting sends this for admin review. It won&apos;t be visible to drivers until approved.
      </p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          Submit for review
        </Button>
      </div>
    </div>
  );
}
