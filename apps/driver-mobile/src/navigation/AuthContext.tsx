import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPersonas, selectPersona as apiSelectPersona } from "../api/personas";
import { getAccessToken } from "../session";

type Persona = "driver" | "owner";

interface AuthContextValue {
  isLoggedIn: boolean;
  checkingSession: boolean;
  /** null = still resolving personas after login; only meaningful once isLoggedIn is true. */
  personaPending: boolean;
  activePersona: Persona | null;
  /** Which personas the server currently grants this user — drives AC-8 (hide/route away from a revoked persona). */
  availablePersonas: Persona[];
  isNewUserPending: boolean;
  login: (isNewUser: boolean) => Promise<void>;
  selectPersona: (persona: Persona) => Promise<void>;
  logout: () => void;
  wizardFinished: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [personaPending, setPersonaPending] = useState(false);
  const [activePersona, setActivePersona] = useState<Persona | null>(null);
  const [availablePersonas, setAvailablePersonas] = useState<Persona[]>(["driver"]);
  const [isNewUserPending, setIsNewUserPending] = useState(false);

  async function resolvePersonaState() {
    const personas = await getPersonas();
    setAvailablePersonas(personas.available);
    if (personas.lastPersona === null) {
      setPersonaPending(true);
      setActivePersona(null);
    } else if (personas.lastPersona === "owner" && !personas.available.includes("owner")) {
      // AC-8: the host role was revoked since this user's last session — the
      // owner dashboard must never reappear on load; land on driver instead.
      setPersonaPending(false);
      setActivePersona("driver");
    } else {
      setPersonaPending(false);
      setActivePersona(personas.lastPersona);
    }
  }

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      setIsLoggedIn(token !== null);
      if (token !== null) {
        try {
          await resolvePersonaState();
        } catch {
          // If this fails (e.g. token expired since app was last opened),
          // the first authenticated request will 401 and clear the session
          // through the normal apiRequest path — no special handling needed here.
        }
      }
      setCheckingSession(false);
    })();
  }, []);

  const value: AuthContextValue = {
    isLoggedIn,
    checkingSession,
    personaPending,
    activePersona,
    availablePersonas,
    isNewUserPending,
    login: async (isNewUser) => {
      setIsLoggedIn(true);
      setIsNewUserPending(isNewUser);
      await resolvePersonaState();
    },
    selectPersona: async (persona) => {
      const result = await apiSelectPersona(persona);
      setPersonaPending(false);
      setAvailablePersonas(result.available);
      setActivePersona(result.lastPersona);
    },
    logout: () => {
      setIsLoggedIn(false);
      setPersonaPending(false);
      setActivePersona(null);
      setAvailablePersonas(["driver"]);
      setIsNewUserPending(false);
    },
    wizardFinished: () => setIsNewUserPending(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
