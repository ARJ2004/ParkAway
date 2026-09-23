import { Button, InlineBanner, OtpInput } from "@parkaway/ui-web";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { requestOtp, verifyOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { getPersonas } from "../api/personas";
import { setSession } from "../session";
import { setActiveTheme } from "../theme";
import { AuthLayout, authLayoutStyles } from "../components/AuthLayout";

const RESEND_COOLDOWN_SECONDS = 30;
// Must match the backend's OTP_LENGTH (env.ts) — the length the OTP input
// actually collects, not an arbitrary "looks long enough" guess. A mismatch
// here is exactly the bug that made DEV_OTP_BYPASS_CODE=1234 silently never
// match a 6-digit OTP_LENGTH.
const OTP_LENGTH = 6;

export function OtpEntryScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { phone?: string; next?: "manage" } | null;
  const phone = locationState?.phone;
  const next = locationState?.next;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!phone) {
      navigate(next === "manage" ? "/manage/login" : "/", { replace: true });
    }
  }, [phone, next, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(submittedCode: string) {
    if (!phone || submittedCode.length !== OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    try {
      const result = await verifyOtp(phone, submittedCode);
      setSession(result.accessToken, result.refreshToken);

      // The Property Manager Console has its own login entry point and never
      // sees the driver/owner persona picker — a property manager isn't
      // necessarily a driver or a host at all (§2.2a's persona-vs-auth split
      // stays intact: `/manage`'s screens still authorize every request via
      // requirePropertyScope, this redirect is only UI routing).
      if (next === "manage") {
        navigate("/manage", { replace: true });
        return;
      }

      const personas = await getPersonas();
      if (personas.lastPersona === null) {
        // First login (or an existing Sprint 1 account that's never chosen a
        // persona) — the picker is a first-login moment, not a per-login toll.
        navigate("/persona", { replace: true, state: { isNewUser: result.isNewUser } });
      } else if (personas.lastPersona === "owner") {
        setActiveTheme("host");
        navigate("/owner", { replace: true });
      } else {
        setActiveTheme("driver");
        navigate(result.isNewUser ? "/onboarding/profile" : "/home", { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // Each failure mode gets its own specific message — never a shared
        // generic "something went wrong" (Sprint 1 UX flow requirement).
        const messages: Record<string, string> = {
          OTP_INCORRECT: err.message,
          OTP_INVALIDATED: "Too many incorrect attempts. Request a new code below.",
          OTP_EXPIRED_OR_NOT_FOUND: "This code has expired. Request a new one below.",
          OTP_ALREADY_USED: "This code was already used. Request a new one below.",
          ACCOUNT_SUSPENDED: "This account has been suspended. Contact support for help.",
          RATE_LIMITED: "Too many attempts — please try again shortly.",
        };
        setError(messages[err.code] ?? err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!phone || cooldown > 0) return;
    setError(null);
    setCode("");
    try {
      await requestOtp(phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Could not resend the code — please try again shortly.");
    }
  }

  if (!phone) return null;

  return (
    <AuthLayout heading="Enter the code" subheading={`We sent a code to ${phone}`}>
      <div className={authLayoutStyles.form}>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}
        <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} error={!!error} autoFocus />
        <Button onClick={() => handleVerify(code)} fullWidth loading={loading} disabled={code.length !== OTP_LENGTH}>
          Verify
        </Button>
        <button type="button" className={authLayoutStyles.link} onClick={handleResend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        <button
          type="button"
          className={authLayoutStyles.link}
          onClick={() => navigate(next === "manage" ? "/manage/login" : "/", { replace: true })}
        >
          Change number
        </button>
      </div>
    </AuthLayout>
  );
}
