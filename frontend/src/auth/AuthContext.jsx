import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // sessionStorage, not localStorage — it's scoped to this one tab instead
  // of shared across every tab of the site. That matters here specifically
  // because Customer/Team/Admin are meant to be logged into simultaneously
  // in separate tabs; a shared key means the last tab to log in silently
  // overwrites every other tab's session.
  const [auth, setAuth] = useState(() => {
    try {
      const raw = sessionStorage.getItem("auth");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (auth) sessionStorage.setItem("auth", JSON.stringify(auth));
    else sessionStorage.removeItem("auth");
  }, [auth]);

  async function login(email, password) {
    const res = await api.login(email, password);
    setAuth(res);
    return res;
  }

  async function signup(name, email, password) {
    const res = await api.signup(name, email, password);
    setAuth(res);
    return res;
  }

  function logout() {
    setAuth(null);
  }

  return <AuthContext.Provider value={{ auth, login, signup, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
