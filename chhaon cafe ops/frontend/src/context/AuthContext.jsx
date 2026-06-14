import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import { saveAccessToken, clearAccessToken } from "@/lib/authStorage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // null = checking, false = guest, object = authenticated user
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (mobile, password) => {
    const { data } = await api.post("/auth/login", { mobile, password });
    saveAccessToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const staffLogin = useCallback(async (passcode) => {
    const { data } = await api.post("/auth/staff-login", { passcode });
    saveAccessToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      const { stopMesh } = await import("@/offline/sync");
      await stopMesh();
    } catch { /* ignore */ }
    clearAccessToken();
    try {
      await api.post("/auth/logout");
    } catch {
      // best-effort; still clear local state
    }
    setUser(false);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, staffLogin, logout, refresh: fetchMe }),
    [user, loading, login, staffLogin, logout, fetchMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
