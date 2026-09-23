import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@parkaway/ui-web";
import { logout } from "../api/auth";
import { clearSession, getRefreshToken } from "../session";
import { setActiveTheme } from "../theme";
import styles from "./AppShell.module.css";

export interface ActiveProperty {
  name: string;
  authorizationState: "active" | "expiring" | "expired" | "revoked" | "none";
}

const AUTH_BADGE: Record<ActiveProperty["authorizationState"], { label: string; variant: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Authorized", variant: "success" },
  expiring: { label: "Expiring soon", variant: "warning" },
  expired: { label: "Expired", variant: "danger" },
  revoked: { label: "Revoked", variant: "danger" },
  none: { label: "Not authorized", variant: "neutral" },
};

/**
 * Property Manager Console, folded into `driver-web` as its own route tree
 * with its own login (`/manage/login`) rather than a separate `apps/property-web`
 * app — a deployment/routing decision, not a design one; it still reuses the
 * `admin` theme deliberately (same design family as the internal admin
 * console: dense, scannable, unglamorous — `frontend.md`), with one
 * addition: a persistent property-scope chrome so an external manager is
 * never confused about which property they're acting on, or mistakes this
 * for the internal console.
 */
export function PropertyManagerShell({ children, activeProperty }: { children: ReactNode; activeProperty?: ActiveProperty }) {
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTheme("admin");
  }, []);

  async function handleLogout() {
    const refreshToken = getRefreshToken();
    clearSession();
    if (refreshToken) logout(refreshToken).catch(() => {});
    navigate("/manage/login", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.brand}>ParkAway · Property Console</span>
        {activeProperty && (
          <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--color-text-secondary)" }}>
            {activeProperty.name}
            <Badge label={AUTH_BADGE[activeProperty.authorizationState].label} variant={AUTH_BADGE[activeProperty.authorizationState].variant} />
          </span>
        )}
        <div className={styles.navLinks}>
          <button className={styles.navLink} onClick={() => navigate("/manage")}>
            Properties
          </button>
          <button className={styles.navLink} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </nav>
      <div className={styles.content} style={{ maxWidth: "960px" }}>
        {children}
      </div>
    </div>
  );
}
