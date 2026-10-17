import { createContext, useContext, useEffect, useState } from "react";
import { applyTheme, resetTheme } from "../utils/theme";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  // Aplica o tema do ginásio na carga inicial (utilizador já estava logado).
  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const u = JSON.parse(stored);
      if (u?.gym_accent) applyTheme(u.gym_accent, u.gym_secondary);
    }
  }, []);

  function login(newToken, newUser) {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    if (newUser?.gym_accent) applyTheme(newUser.gym_accent, newUser.gym_secondary);
    else resetTheme();
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    resetTheme();
  }

  // Atualiza campos do user guardado (ex: avatar_url depois de um upload)
  // sem precisar de um novo login.
  function updateUser(patch) {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem("user", JSON.stringify(next));
      if (patch.gym_accent !== undefined || patch.gym_secondary !== undefined) {
        if (next.gym_accent) applyTheme(next.gym_accent, next.gym_secondary);
        else resetTheme();
      }
      return next;
    });
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
