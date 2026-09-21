import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getAccessToken } from "../session";

interface AuthContextValue {
  isLoggedIn: boolean;
  isNewUserPending: boolean;
  checkingSession: boolean;
  login: (isNewUser: boolean) => void;
  logout: () => void;
  wizardFinished: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isNewUserPending, setIsNewUserPending] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    getAccessToken()
      .then((token) => setIsLoggedIn(token !== null))
      .finally(() => setCheckingSession(false));
  }, []);

  const value: AuthContextValue = {
    isLoggedIn,
    isNewUserPending,
    checkingSession,
    login: (isNewUser) => {
      setIsLoggedIn(true);
      setIsNewUserPending(isNewUser);
    },
    logout: () => setIsLoggedIn(false),
    wizardFinished: () => setIsNewUserPending(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
