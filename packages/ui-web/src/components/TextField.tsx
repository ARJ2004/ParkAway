import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";
import styles from "./TextField.module.css";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** e.g. a "Verified" badge next to a read-only phone field */
  badge?: ReactNode;
}

export function TextField({ label, error, hint, badge, id, className, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={styles.wrapper}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} className={[styles.input, error ? styles.error : "", className].filter(Boolean).join(" ")} {...rest} />
      {badge && <span className={styles.badge}>{badge}</span>}
      {error && <span className={styles.errorText}>{error}</span>}
      {!error && hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}
