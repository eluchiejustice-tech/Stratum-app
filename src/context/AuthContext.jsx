import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import { getProfile } from "../services/auth";
import { authenticateWithPi } from "../services/piAuth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [piSession, setPiSession] = useState(null);
  const [piLoading, setPiLoading] = useState(false);
  const [piError, setPiError] = useState("");

  const signInWithPi = useCallback(async () => {
    if (piLoading) return { error: new Error("Pi sign-in is already in progress.") };
    setPiLoading(true);
    setPiError("");
    try {
      const session = await authenticateWithPi();
      setPiSession(session);
      return { data: session, error: null };
    } catch (error) {
      setPiError(error?.message || "Pi Network sign-in failed.");
      return { data: null, error };
    } finally {
      setPiLoading(false);
    }
  }, [piLoading]);

  const signOutPi = useCallback(() => {
    setPiSession(null);
    setPiError("");
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }
    const { data } = await getProfile(user.id);
    setProfile(data);
  }, [user]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    loading,
    refreshProfile,
    piUser: piSession?.user ?? null,
    piSessionToken: piSession?.sessionToken ?? null,
    piLoading,
    piError,
    signInWithPi,
    signOutPi,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within an AuthProvider");
  return ctx;
}
