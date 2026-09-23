import { Button, InlineBanner, MapPicker, Select, TextField, Toggle } from "@parkaway/ui-web";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { geocode } from "../../api/geo";
import { createProperty, type LatLng } from "../../api/properties";
import { OwnerAppShell } from "../../components/OwnerAppShell";

const PROPERTY_TYPES = [
  { value: "independent_home", label: "My home / driveway" },
  { value: "standalone", label: "A standalone commercial space I own" },
];

/**
 * The reduced, owner-persona version of property creation (§2.5's
 * "two entry points, one backend" note) — no authorization tab, since
 * `independent_home`/`standalone` properties are self-authorized in the
 * same transaction as creation (locked decision 4). Just identity + location
 * + whether outsiders may park here.
 */
export function OwnerPropertyFormScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]!.value);
  const [addressLine1, setAddressLine1] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [outsidersAllowed, setOutsidersAllowed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLookupAddress(address: string) {
    const result = await geocode(address);
    return result?.point ?? null;
  }

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
      navigate(`/owner/listings?propertyId=${property.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the property — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OwnerAppShell>
      <h1>Add a property</h1>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <Select label="What kind of property is this?" options={PROPERTY_TYPES} value={propertyType} onChange={(e) => setPropertyType(e.target.value)} />
        <TextField label="Property name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My driveway" />
        <TextField label="Address" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="House / building, street" />
        <TextField label="Locality" value={locality} onChange={(e) => setLocality(e.target.value)} />
        <div style={{ display: "flex", gap: "12px" }}>
          <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
          <TextField label="State" value={state} onChange={(e) => setState(e.target.value)} />
          <TextField label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
        </div>
        <MapPicker label="Location" value={location} onChange={setLocation} onLookupAddress={handleLookupAddress} hint="Search the address, or enter coordinates directly." />
        <Toggle
          label="Allow anyone to book this space"
          hint="Turn off if only people you've personally authorized should ever see or book it."
          checked={outsidersAllowed}
          onChange={setOutsidersAllowed}
        />
        <Button onClick={handleSubmit} loading={loading} style={{ alignSelf: "flex-start" }}>
          Save property
        </Button>
      </div>
    </OwnerAppShell>
  );
}
