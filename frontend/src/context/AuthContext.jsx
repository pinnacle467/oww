import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { tokenStore, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null); // null = checking, false = signed out, object = signed in
  const [checking, setChecking] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokenStore.get()) {
      setAdmin(false);
      setChecking(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setAdmin(data);
    } catch {
      tokenStore.clear();
      setAdmin(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const completeLogin = useCallback((token, user) => {
    tokenStore.set(token);
    setAdmin(user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ admin, checking, completeLogin, logout, refresh: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { formatApiError };
