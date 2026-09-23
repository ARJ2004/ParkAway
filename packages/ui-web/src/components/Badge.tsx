import styles from "./Badge.module.css";

export interface BadgeProps {
  label: string;
  variant?: "success" | "accent" | "neutral" | "warning" | "danger";
}

/** Small status pill — verification/authorization chips, "Verified" next to a field, etc. Same prop shape as ui-native's Badge. */
export function Badge({ label, variant = "neutral" }: BadgeProps) {
  return <span className={[styles.badge, styles[variant]].join(" ")}>{label}</span>;
}
