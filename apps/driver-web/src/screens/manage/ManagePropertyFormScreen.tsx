import { Button, Card, InlineBanner, MapPicker, Select, TextField, Toggle } from "@parkaway/ui-web";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../api/client";
import { geocode } from "../../api/geo";
import { createProperty, type LatLng } from "../../api/properties";
import { PropertyManagerShell } from "../../components/PropertyManagerShell";

const PROPERTY_TYPES = [
  { value: "society", label: "Residential society" },
  { value: "commercial", label: "Commercial property" },
];

/**
 * A three-section single page, not a wizard (§2.5's UX flow) — a desktop
 * form filled once by someone who has all the information in front of
 * them. No authorization step here: society/commercial properties are
 * authorized separately, on the property detail page's Authorization tab,
 * with supporting documents.
 */
export function ManagePropertyFormScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState(PROPERTY_TYPES[0]!.value);
  const [addressLine1, setAddressLine1] = useState("");
  const [locality, setLocality] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("");
  const [location, setLocation] = useState<LatLng | null>(null);
  const [entryLocation, setEntryLocation] = useState<LatLng | null>(null);
  const [outsidersAllowed, setOutsidersAllowed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLookupAddress(address: string) {
    const result = await geocode(address);
    return result?.point ?? null;
  }

  async function handleSubmit() {
    if (!name.trim() || !addressLine1.trim() || !locality.trim() || !city.trim() || !state.trim() || !pincode.trim() || !location || !entryLocation) {
      setError("Fill in identity, address and both location pins before continuing.");
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
        entryLocation,
        outsiderPolicy: outsidersAllowed ? "allowed" : "authorized_only",
      });
      navigate(`/manage/properties/${property.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the property — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PropertyManagerShell>
      <h1>Add a property</h1>
      {error && <InlineBanner variant="danger">{error}</InlineBanner>}

      <Card>
        <h2 style={{ marginTop: 0 }}>Identity</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Select label="Property type" options={PROPERTY_TYPES} value={propertyType} onChange={(e) => setPropertyType(e.target.value)} />
          <TextField label="Property name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Green Meadows Society" />
          <TextField label="Address" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          <TextField label="Locality" value={locality} onChange={(e) => setLocality(e.target.value)} />
          <div style={{ display: "flex", gap: "12px" }}>
            <TextField label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <TextField label="State" value={state} onChange={(e) => setState(e.target.value)} />
            <TextField label="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Location</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <MapPicker label="Property centre" value={location} onChange={setLocation} onLookupAddress={handleLookupAddress} />
          <MapPicker label="Entry gate (where a driver actually arrives — SRCH-08)" value={entryLocation} onChange={setEntryLocation} />
        </div>
      </Card>

      <Card>
        <h2 style={{ marginTop: 0 }}>Policy</h2>
        <Toggle
          label="Allow outsiders to book spaces here"
          hint="Off means only spaces you've explicitly authorized are ever exposed to the marketplace (rule 9)."
          checked={outsidersAllowed}
          onChange={setOutsidersAllowed}
        />
      </Card>

      <Button onClick={handleSubmit} loading={loading} style={{ alignSelf: "flex-start" }}>
        Save property
      </Button>
    </PropertyManagerShell>
  );
}
