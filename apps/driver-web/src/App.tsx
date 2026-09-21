import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { isLoggedIn } from "./session";
import { PhoneEntryScreen } from "./screens/PhoneEntryScreen";
import { OtpEntryScreen } from "./screens/OtpEntryScreen";
import { OnboardingWizardScreen } from "./screens/OnboardingWizardScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { VehicleListScreen } from "./screens/VehicleListScreen";
import { VehicleFormScreen } from "./screens/VehicleFormScreen";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<PhoneEntryScreen />} />
      <Route path="/otp" element={<OtpEntryScreen />} />
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
        path="/profile"
        element={
          <RequireAuth>
            <ProfileScreen />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
