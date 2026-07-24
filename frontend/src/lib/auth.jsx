import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

// Sessão persistente via localStorage — não desloga ao fechar o navegador.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("fc_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  function login(token, userData) {
    localStorage.setItem("fc_token", token);
    localStorage.setItem("fc_user", JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem("fc_token");
    localStorage.removeItem("fc_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
