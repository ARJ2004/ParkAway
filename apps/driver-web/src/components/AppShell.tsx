import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { clearSession, getRefreshToken } from "../session";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function handleLogout() {
    const refreshToken = getRefreshToken();
    clearSession();
    if (refreshToken) {
      // Best-effort — the session is already cleared client-side regardless.
      logout(refreshToken).catch(() => {});
    }
    navigate("/", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.brand}>ParkAway</span>
        <div className={styles.navLinks}>
          <button className={styles.navLink} onClick={() => navigate("/home")}>
            Home
          </button>
          <button className={styles.navLink} onClick={() => navigate("/vehicles")}>
            Vehicles
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
