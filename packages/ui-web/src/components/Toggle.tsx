import { useId } from "react";
import styles from "./Toggle.module.css";

export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}

/** Covered / amenities / escort-required — a labelled on-off switch, never a bare checkbox for a yes/no state toggle. */
export function Toggle({ label, checked, onChange, hint, disabled }: ToggleProps) {
  const id = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={[styles.track, checked ? styles.on : ""].join(" ")}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}
