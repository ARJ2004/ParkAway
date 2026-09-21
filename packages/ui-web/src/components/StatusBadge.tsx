import styles from "./StatusBadge.module.css";

export interface StatusBadgeProps {
  status: "active" | "suspended" | "inactive";
}

/** A distinct filled pill per status — "suspended" must never read as merely red text on the same layout as everything else. */
export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={[styles.badge, styles[status]].join(" ")}>{status}</span>;
}
