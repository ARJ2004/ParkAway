import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminLogout } from "../api/auth";
import { clearSession, getRefreshToken, getRole } from "../session";
import styles from "./AdminShell.module.css";

const NAV_ITEMS = [
  { path: "/users", label: "Users" },
  { path: "/listings", label: "Listings" },
];

/** Shared nav shell — the "Listings" item sits beside "Users" (§2.9's Admin Web Console moderation UI). */
export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getRole();

  function handleLogout() {
    const refreshToken = getRefreshToken();
    clearSession();
    if (refreshToken) adminLogout(refreshToken).catch(() => {});
    navigate("/", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <span className={styles.brand}>ParkAway Admin</span>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={[styles.navLink, location.pathname.startsWith(item.path) ? styles.navLinkActive : ""].join(" ")}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
        {role && <span className={styles.roleTag}>{role.replace("_", " ")}</span>}
        <button className={styles.logout} onClick={handleLogout}>
          Log out
        </button>
      </nav>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
