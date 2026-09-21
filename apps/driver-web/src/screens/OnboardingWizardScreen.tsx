import { Button, InlineBanner, TextField, WizardProgress } from "@parkaway/ui-web";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { updateProfile } from "../api/profile";
import { addVehicle } from "../api/vehicles";
import { ApiError } from "../api/client";
import styles from "./OnboardingWizardScreen.module.css";

const VEHICLE_TYPES = ["hatchback", "sedan", "suv", "bike", "commercial"] as const;

export function OnboardingWizardScreen() {
  const { step } = useParams<{ step: "profile" | "vehicle" }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const currentIndex = step === "vehicle" ? 1 : 0;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [type, setType] = useState<string>(VEHICLE_TYPES[0]);

  async function handleProfileContinue() {
    if (!name && !email) {
      navigate("/onboarding/vehicle");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updateProfile({ ...(name ? { name } : {}), ...(email ? { email } : {}) });
      navigate("/onboarding/vehicle");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your profile — you can add this later.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVehicleContinue() {
    if (!registrationNo) {
      navigate("/home");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await addVehicle({ registrationNo, type });
      navigate("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save your vehicle — you can add this later.");
    } finally {
      setLoading(false);
    }
  }

  const isProfileStep = step !== "vehicle";

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <WizardProgress total={2} currentIndex={currentIndex} />
        {isProfileStep ? (
          <>
            <div>
              <h1 className={styles.heading}>Tell us about you</h1>
              <p className={styles.subheading}>Recommended — helps hosts and support recognize you. Skip anytime.</p>
            </div>
            {error && <InlineBanner variant="danger">{error}</InlineBanner>}
            <div className={styles.form}>
              <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <div className={styles.actions}>
                <Button variant="skip" onClick={() => navigate("/onboarding/vehicle")} disabled={loading}>
                  Skip
                </Button>
                <Button onClick={handleProfileContinue} loading={loading}>
                  Continue
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className={styles.heading}>Add your vehicle</h1>
              <p className={styles.subheading}>Recommended — book faster next time. Skip anytime, add it later from your account.</p>
            </div>
            {error && <InlineBanner variant="danger">{error}</InlineBanner>}
            <div className={styles.form}>
              <TextField
                label="Registration number"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                placeholder="MH12AB1234"
              />
              <label className={styles.subheading} htmlFor="vehicle-type">
                Vehicle type
              </label>
              <select id="vehicle-type" className={styles.select} value={type} onChange={(e) => setType(e.target.value)}>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
              <div className={styles.actions}>
                <Button variant="skip" onClick={() => navigate("/home")} disabled={loading}>
                  Skip
                </Button>
                <Button onClick={handleVehicleContinue} loading={loading}>
                  Finish
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
