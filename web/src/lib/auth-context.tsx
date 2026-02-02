'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { storage } from './storage';
import { api, ApiError, AUTH_INVALIDATED_EVENT } from './api';
import type { User, AuthResponse, SessionEndReason } from './types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionEndReason: SessionEndReason | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearSessionEndReason: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionEndReason, setSessionEndReason] = useState<SessionEndReason | null>(null);

  // Initialize auth state from storage
  useEffect(() => {
    const auth = storage.getAuth();
    if (auth?.user) {
      setUser(auth.user);
    }
    setIsLoading(false);
  }, []);

  // Listen for auth invalidation events
  useEffect(() => {
    function handleAuthInvalidated(event: Event) {
      const customEvent = event as CustomEvent<{ reason: SessionEndReason }>;
      setSessionEndReason(customEvent.detail.reason);
      setUser(null);
      router.push('/login');
    }

    window.addEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    };
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
    setSessionEndReason(null);
    return response;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const response = await api.register(email, password);
    setUser(response.user);
    setSessionEndReason(null);
    return response;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      router.push('/login');
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    const response = await api.refreshUser();
    if (response?.user) {
      setUser(response.user);
    }
  }, []);

  const clearSessionEndReason = useCallback(() => {
    setSessionEndReason(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    sessionEndReason,
    login,
    register,
    logout,
    refreshUser,
    clearSessionEndReason,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Re-export ApiError for convenience
 */
export { ApiError };
