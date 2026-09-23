import { useState } from "react";
import styles from "./MapPicker.module.css";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapPickerProps {
  label?: string;
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  /** Wraps the `MapsProvider` adapter via the API — never imports `mapbox-gl` directly (non-negotiable rule 4). */
  onLookupAddress?: (address: string) => Promise<LatLng | null>;
  hint?: string;
}

/**
 * No `MAPBOX_TOKEN` is provisioned yet (`tech-stack.md` §12) — this is
 * coordinate entry backed by the server-side geocode adapter, not a visual
 * pin-drop map. A real interactive map (mapbox-gl / @rnmapbox/maps) is a
 * drop-in replacement for this component's body once a token exists; the
 * `onChange(LatLng)` contract stays the same either way, so nothing above
 * this component needs to change when that lands.
 */
export function MapPicker({ label, value, onChange, onLookupAddress, hint }: MapPickerProps) {
  const [addressQuery, setAddressQuery] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup() {
    if (!onLookupAddress || !addressQuery.trim()) return;
    setLooking(true);
    setError(null);
    try {
      const point = await onLookupAddress(addressQuery);
      if (point) onChange(point);
      else setError("Address not found");
    } catch {
      setError("Lookup failed — try entering coordinates directly");
    } finally {
      setLooking(false);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setError("Location isn't available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setError("Couldn't get your location")
    );
  }

  return (
    <div className={styles.wrapper}>
      {label && <span className={styles.label}>{label}</span>}
      {onLookupAddress && (
        <div className={styles.lookupRow}>
          <input
            className={styles.lookupInput}
            placeholder="Search an address"
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
          />
          <button type="button" className={styles.lookupButton} onClick={handleLookup} disabled={looking}>
            {looking ? "…" : "Find"}
          </button>
        </div>
      )}
      <div className={styles.coordsRow}>
        <label className={styles.coordLabel}>
          Lat
          <input
            type="number"
            step="any"
            className={styles.coordInput}
            value={value?.lat ?? ""}
            onChange={(e) => onChange({ lat: Number(e.target.value), lng: value?.lng ?? 0 })}
          />
        </label>
        <label className={styles.coordLabel}>
          Lng
          <input
            type="number"
            step="any"
            className={styles.coordInput}
            value={value?.lng ?? ""}
            onChange={(e) => onChange({ lat: value?.lat ?? 0, lng: Number(e.target.value) })}
          />
        </label>
        <button type="button" className={styles.locateButton} onClick={handleUseMyLocation}>
          Use my location
        </button>
      </div>
      {error && <span className={styles.error}>{error}</span>}
      {!error && hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
