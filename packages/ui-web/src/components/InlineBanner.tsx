import type { ReactNode } from "react";
import styles from "./InlineBanner.module.css";

export interface InlineBannerProps {
  variant?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}

/** Status/error messaging with a distinct look per severity — never a shared generic "alert" box. */
export function InlineBanner({ variant = "info", children }: InlineBannerProps) {
  return (
    <div className={[styles.banner, styles[variant]].join(" ")} role={variant === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}
