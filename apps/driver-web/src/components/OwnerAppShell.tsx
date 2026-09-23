import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { clearSession, getRefreshToken } from "../session";
import { setActiveTheme } from "../theme";
import styles from "./AppShell.module.css";

/**
 * The owner persona's shell — same layout shell as the driver `AppShell`
 * (shared spacing/structure), themed `host` instead of `driver`, with a
 * different nav set. Per §3.1's rule: the fork happens once, at the
 * navigator/shell level — no screen below this takes an `isOwner` prop.
 */
export function OwnerAppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    setActiveTheme("host");
  }, []);

  async function handleLogout() {
    const refreshToken = getRefreshToken();
    clearSession();
    if (refreshToken) {
      logout(refreshToken).catch(() => {});
    }
    navigate("/", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.brand}>ParkAway · Owner</span>
        <div className={styles.navLinks}>
          <button className={styles.navLink} onClick={() => navigate("/owner")}>
            Home
          </button>
          <button className={styles.navLink} onClick={() => navigate("/owner/properties")}>
            Properties
          </button>
          <button className={styles.navLink} onClick={() => navigate("/owner/listings")}>
            Spaces
          </button>
          <button className={styles.navLink} onClick={() => navigate("/profile")}>
            Profile
          </button>
          <button className={styles.navLink} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
