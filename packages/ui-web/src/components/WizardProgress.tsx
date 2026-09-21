import styles from "./WizardProgress.module.css";

export interface WizardProgressProps {
  total: number;
  currentIndex: number;
}

export function WizardProgress({ total, currentIndex }: WizardProgressProps) {
  return (
    <div className={styles.row} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={[styles.dot, i === currentIndex ? styles.dotActive : "", i < currentIndex ? styles.dotDone : ""]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}
