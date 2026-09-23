import { Button, InlineBanner, TextField } from "@parkaway/ui-web";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestOtp } from "../api/auth";
import { ApiError } from "../api/client";
import { AuthLayout, authLayoutStyles } from "../components/AuthLayout";

export interface PhoneEntryScreenProps {
  /** Set when reached via the Property Manager Console's own login entry — see OtpEntryScreen's routing. */
  next?: "manage";
  heading?: string;
  subheading?: string;
}

export function PhoneEntryScreen({ next, heading, subheading }: PhoneEntryScreenProps = {}) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await requestOtp(phone);
      navigate("/otp", { state: { phone, next } });
    } catch (err) {
      if (err instanceof ApiError && err.code === "RATE_LIMITED") {
        setError("Too many attempts for this number — please try again in a little while.");
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout heading={heading ?? "Find guaranteed parking"} subheading={subheading ?? "Enter your mobile number to continue"}>
      <form className={authLayoutStyles.form} onSubmit={handleSubmit}>
        {error && <InlineBanner variant="danger">{error}</InlineBanner>}
        <TextField
          label="Mobile number"
          type="tel"
          inputMode="tel"
          placeholder="+91 98765 43210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoFocus
          required
        />
        <Button type="submit" fullWidth loading={loading}>
          Continue
        </Button>
      </form>
    </AuthLayout>
  );
}
