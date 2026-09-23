import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { isLoggedIn } from "./session";
import { PhoneEntryScreen } from "./screens/PhoneEntryScreen";
import { OtpEntryScreen } from "./screens/OtpEntryScreen";
import { PersonaCard } from "./screens/PersonaCard";
import { OnboardingWizardScreen } from "./screens/OnboardingWizardScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { VehicleListScreen } from "./screens/VehicleListScreen";
import { VehicleFormScreen } from "./screens/VehicleFormScreen";
import { OwnerHomeScreen } from "./screens/owner/OwnerHomeScreen";
import { OwnerPropertyListScreen } from "./screens/owner/OwnerPropertyListScreen";
import { OwnerPropertyFormScreen } from "./screens/owner/OwnerPropertyFormScreen";
import { OwnerListingListScreen } from "./screens/owner/OwnerListingListScreen";
import { ListingWizardScreen } from "./screens/owner/ListingWizardScreen";
import { HostKycScreen } from "./screens/owner/HostKycScreen";
import { HostPayoutScreen } from "./screens/owner/HostPayoutScreen";
import { ManageLoginScreen } from "./screens/manage/ManageLoginScreen";
import { ManagePropertyListScreen } from "./screens/manage/ManagePropertyListScreen";
import { ManagePropertyFormScreen } from "./screens/manage/ManagePropertyFormScreen";
import { ManagePropertyDetailScreen } from "./screens/manage/ManagePropertyDetailScreen";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RequireManageAuth({ children }: { children: ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/manage/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      {/* Driver / owner OTP login (unchanged) and the first-login persona picker (Group D) */}
      <Route path="/" element={<PhoneEntryScreen />} />
      <Route path="/otp" element={<OtpEntryScreen />} />
      <Route
        path="/persona"
        element={
          <RequireAuth>
            <PersonaCard />
          </RequireAuth>
        }
      />

      {/* Driver persona — unchanged from Sprint 1 */}
      <Route
        path="/onboarding/:step"
        element={
          <RequireAuth>
            <OnboardingWizardScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <HomeScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/vehicles"
        element={
          <RequireAuth>
            <VehicleListScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/vehicles/new"
        element={
          <RequireAuth>
            <VehicleFormScreen />
          </RequireAuth>
        }
      />
      {/* Shared across both personas — see ProfileScreen's doc comment (§3.1 rule 2) */}
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfileScreen />
          </RequireAuth>
        }
      />

      {/* Owner persona — a mode inside this same app, not a separate app (locked decision O-8) */}
      <Route
        path="/owner"
        element={
          <RequireAuth>
            <OwnerHomeScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/owner/properties"
        element={
          <RequireAuth>
            <OwnerPropertyListScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/owner/properties/new"
        element={
          <RequireAuth>
            <OwnerPropertyFormScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/owner/listings"
        element={
          <RequireAuth>
            <OwnerListingListScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/owner/listings/:id/edit/:step"
        element={
          <RequireAuth>
            <ListingWizardScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/owner/kyc"
        element={
          <RequireAuth>
            <HostKycScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/owner/payout"
        element={
          <RequireAuth>
            <HostPayoutScreen />
          </RequireAuth>
        }
      />

      {/* Property Manager Console — its own login entry, same backend identity system, no persona picker */}
      <Route path="/manage/login" element={<ManageLoginScreen />} />
      <Route
        path="/manage"
        element={
          <RequireManageAuth>
            <ManagePropertyListScreen />
          </RequireManageAuth>
        }
      />
      <Route
        path="/manage/properties/new"
        element={
          <RequireManageAuth>
            <ManagePropertyFormScreen />
          </RequireManageAuth>
        }
      />
      <Route
        path="/manage/properties/:id"
        element={
          <RequireManageAuth>
            <ManagePropertyDetailScreen />
          </RequireManageAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
