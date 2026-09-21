import { Button, Card, InlineBanner, TextField } from "@parkaway/ui-web";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { addVehicle } from "../api/vehicles";
import { AppShell } from "../components/AppShell";
import styles from "./OnboardingWizardScreen.module.css";

const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"] as const;

export function VehicleFormScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [registrationNo, setRegistrationNo] = useState("");
  const [type, setType] = useState<string>(VEHICLE_TYPES[0]);
  const [makeModel, setMakeModel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => addVehicle({ registrationNo, type, makeModel: makeModel || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      navigate("/vehicles");
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Could not add this vehicle.");
    },
  });

  return (
    <AppShell>
      <h1>Add a vehicle</h1>
      <Card>
        <div className={styles.form}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <TextField
            label="Registration number"
            value={registrationNo}
            onChange={(e) => setRegistrationNo(e.target.value)}
            placeholder="MH12AB1234"
            autoFocus
          />
          <label className={styles.subheading} htmlFor="vehicle-type-standalone">
            Vehicle type
          </label>
          <select id="vehicle-type-standalone" className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
            {VEHICLE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
          <TextField
            label="Make & model (optional)"
            value={makeModel}
            onChange={(e) => setMakeModel(e.target.value)}
            placeholder="e.g. Maruti Swift"
          />
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!registrationNo}>
            Add vehicle
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}
