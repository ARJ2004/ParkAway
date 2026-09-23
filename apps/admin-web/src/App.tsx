import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { isLoggedIn } from "./session";
import { AdminLoginScreen } from "./screens/AdminLoginScreen";
import { UserSearchScreen } from "./screens/UserSearchScreen";
import { ModerationQueueScreen } from "./screens/ModerationQueueScreen";
import { HostKycReviewScreen } from "./screens/HostKycReviewScreen";

function RequireAuth({ children }: { children: ReactNode }) {
  if (!isLoggedIn()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminLoginScreen />} />
      <Route
        path="/users"
        element={
          <RequireAuth>
            <UserSearchScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/listings"
        element={
          <RequireAuth>
            <ModerationQueueScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/hosts/:id/kyc"
        element={
          <RequireAuth>
            <HostKycReviewScreen />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
