import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from './authTypes';
import { ALLOWED_USERS, LEVEL_PASSWORDS } from './allowedUsers';
import { logEvent } from './auditLog';

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
    let id = email.trim().toLowerCase();
    
    if (!id.includes('@')) {
      id = `${id}@unra.go.ug`;
    }

    // Only accept @unra.go.ug emails
    if (!id.endsWith('@unra.go.ug')) {
      logEvent('login_failed', { attempted: id, reason: 'Invalid domain' });
      return false;
    }

    // Determine role based on password matching LEVEL_PASSWORDS
    const roleMatch = (Object.keys(LEVEL_PASSWORDS) as (keyof typeof LEVEL_PASSWORDS)[]).find(
      r => LEVEL_PASSWORDS[r] === password
    );

    if (roleMatch) {
      // Generate a formatted name from the email (e.g. first.last@... -> First Last)
      const nameParts = id.split('@')[0].split('.');
      const name = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

      const withLogin: User = {
        name,
        email: id,
        role: roleMatch,
        id,
        isActive: true,
        lastLogin: new Date().toISOString(),
      };
      
      setUser(withLogin);
      localStorage.setItem('dnr_user', JSON.stringify(withLogin));
      logEvent('login', { level: roleMatch });
      return true;
    }

    logEvent('login_failed', { attempted: id, reason: 'Invalid access code' });
    return false;
  }

  function logout() {
    logEvent('logout');
    setUser(null);
    localStorage.removeItem('dnr_user');
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}
