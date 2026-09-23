import { useId, useState } from "react";
import styles from "./MoneyField.module.css";

export interface MoneyFieldProps {
  label?: string;
  /** Always integer paise in and out — money is never a float anywhere in this codebase (non-negotiable rule, O-4). */
  valuePaise: number | null;
  onChange: (paise: number | null) => void;
  hint?: string;
  error?: string;
  disabled?: boolean;
}

/** Rupee display, paise storage — the one place that conversion happens, so a screen never hand-rolls `* 100` / `/ 100`. */
export function MoneyField({ label, valuePaise, onChange, hint, error, disabled }: MoneyFieldProps) {
  const id = useId();
  const [raw, setRaw] = useState(valuePaise !== null ? String(valuePaise / 100) : "");

  function handleChange(next: string) {
    setRaw(next);
    if (next.trim() === "") {
      onChange(null);
      return;
    }
    const rupees = Number(next);
    if (!Number.isNaN(rupees)) {
      onChange(Math.round(rupees * 100));
    }
  }

  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <div className={[styles.inputRow, error ? styles.error : ""].join(" ")}>
        <span className={styles.symbol}>₹</span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          className={styles.input}
          value={raw}
          disabled={disabled}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
      {!error && hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
