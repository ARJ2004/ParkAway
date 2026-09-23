import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { selectPersona } from "../api/personas";
import { setActiveTheme } from "../theme";
import styles from "./PersonaCard.module.css";

/**
 * First-login-only moment (AC-1, AC-3) — the persona card is asking someone
 * to declare an intent, not enter data. Two full-width cards, equal weight,
 * no pre-selected default, no "recommended" badge — a nudge here would
 * misroute people for the sake of a funnel metric (§3.1).
 */
export function PersonaCard() {
  const navigate = useNavigate();
  const location = useLocation();
  const isNewUser = Boolean((location.state as { isNewUser?: boolean } | null)?.isNewUser);
  const [loading, setLoading] = useState<"driver" | "owner" | null>(null);

  async function pick(persona: "driver" | "owner") {
    setLoading(persona);
    try {
      await selectPersona(persona);
      if (persona === "owner") {
        setActiveTheme("host");
        navigate("/owner", { replace: true });
      } else {
        setActiveTheme("driver");
        navigate(isNewUser ? "/onboarding/profile" : "/home", { replace: true });
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.heading}>What brings you to ParkAway?</h1>
        <div className={styles.cards}>
          <button type="button" className={`${styles.card} ${styles.driverCard}`} onClick={() => pick("driver")} disabled={loading !== null}>
            <span className={styles.icon}>🚗</span>
            <span className={styles.cardTitle}>Park a vehicle</span>
            <span className={styles.cardBody}>Find and book guaranteed parking near you.</span>
          </button>
          <button type="button" className={`${styles.card} ${styles.ownerCard}`} onClick={() => pick("owner")} disabled={loading !== null}>
            <span className={styles.icon}>🅿️</span>
            <span className={styles.cardTitle}>Rent out my space</span>
            <span className={styles.cardBody}>List a parking spot, set your price, earn from it.</span>
          </button>
        </div>
      </div>
    </div>
  );
}
