import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from './authTypes';
import { ALLOWED_USERS, LEVEL_PASSWORDS } from './allowedUsers';

interface AuthCtx {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  login: async () => false,
  logout: () => {},
  isAuthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

// The allowed-users roster lives in allowedUsers.ts (first.lastname@unra.go.ug
// emails, one hardcoded password per access level).

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('dnr_user') ?? 'null'); }
    catch { return null; }
  });

  async function login(email: string, password: string): Promise<boolean> {
    const id = email.trim().toLowerCase();
    const found = ALLOWED_USERS.find(u =>
      (u.email === id || u.email.split('@')[0] === id) && LEVEL_PASSWORDS[u.role] === password);
    if (found) {
      const withLogin: User = {
        ...found, id: found.email, isActive: true, lastLogin: new Date().toISOString(),
      };
      setUser(withLogin);
      localStorage.setItem('dnr_user', JSON.stringify(withLogin));
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('dnr_user');
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
