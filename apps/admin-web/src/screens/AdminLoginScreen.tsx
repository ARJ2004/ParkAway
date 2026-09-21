import { Button, InlineBanner, TextField } from "@parkaway/ui-web";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin } from "../api/auth";
import { ApiError } from "../api/client";
import { setSession } from "../session";
import styles from "./AdminLoginScreen.module.css";

export function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await adminLogin(email, password);
      setSession(result.accessToken, result.refreshToken, result.role);
      navigate("/users", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setError("Too many attempts — please try again shortly.");
      } else {
        // Deliberately generic — matches the backend's refusal to reveal
        // whether the email exists.
        setError("Invalid email or password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div>
          <div className={styles.brand}>ParkAway Admin</div>
          <p className={styles.subtitle}>Sign in with your provisioned account</p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <InlineBanner variant="danger">{error}</InlineBanner>}
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" fullWidth loading={loading}>
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
