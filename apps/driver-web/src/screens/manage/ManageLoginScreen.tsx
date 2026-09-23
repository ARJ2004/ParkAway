import { PhoneEntryScreen } from "../PhoneEntryScreen";

/**
 * The Property Manager Console's own login entry point (folded into
 * driver-web rather than a separate `apps/property-web` app — see
 * ManageLayout's doc comment). Same phone+OTP identity system as the
 * driver/owner flow; the only difference is where verification redirects
 * afterward (straight to `/manage`, never the persona picker) — see
 * OtpEntryScreen's routing.
 */
export function ManageLoginScreen() {
  return <PhoneEntryScreen next="manage" heading="Property Manager Console" subheading="Sign in with your registered mobile number" />;
}
