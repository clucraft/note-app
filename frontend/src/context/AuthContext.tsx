import { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, LoginCredentials, RegisterCredentials } from '../types/auth.types';
import * as authApi from '../api/auth.api';
import { setAccessToken } from '../api';

interface LoginResult {
  requiresTwoFactor?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResult>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        // Try to refresh token first
        await authApi.refreshToken();
        const userData = await authApi.getMe();
        setUser(userData);
      } catch {
        // Not authenticated
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<LoginResult> => {
    const response = await authApi.login(credentials);
    if (authApi.isTwoFactorResponse(response)) {
      return { requiresTwoFactor: true };
    }
    setUser(response.user);
    return {};
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    const response = await authApi.register(credentials);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAccessToken(null);
    setUser(null);
  }, []);

  // Session heartbeat - refresh token periodically to keep session alive
  useEffect(() => {
    if (!user) return;

    const HEARTBEAT_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
    const heartbeat = setInterval(async () => {
      try {
        await authApi.refreshToken();
      } catch {
        console.warn('Session heartbeat failed - token may have expired');
      }
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(heartbeat);
  }, [user]);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
