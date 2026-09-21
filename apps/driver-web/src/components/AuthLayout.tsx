import type { ReactNode } from "react";
import styles from "./AuthLayout.module.css";

export interface AuthLayoutProps {
  heading: string;
  subheading?: string;
  children: ReactNode;
}

/**
 * Deliberately sparse — no marketing carousel, no illustration competing
 * with the single task, per the Sprint 1 UX flow ("the objective is
 * explicitly low-friction, the screen should feel like it takes five
 * seconds, not a funnel").
 */
export function AuthLayout({ heading, subheading, children }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>ParkAway</div>
        <div>
          <h1 className={styles.heading}>{heading}</h1>
          {subheading && <p className={styles.subheading}>{subheading}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export { styles as authLayoutStyles };
