'use client';

import * as Sentry from '@sentry/nextjs';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { storage } from './storage';
import { api, ApiError, AUTH_INVALIDATED_EVENT } from './api';
import type { User, AuthResponse, SessionEndReason } from './types';

// Minimum time between focus-triggered refreshes (30 seconds)
const FOCUS_REFRESH_DEBOUNCE_MS = 30 * 1000;

// Background refresh interval (5 minutes)
const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionEndReason: SessionEndReason | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  fetchUser: () => Promise<User | null>;
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
  const lastFetchTime = useRef(0);

  // Initialize auth state from storage and set Sentry user context
  useEffect(() => {
    const auth = storage.getAuth();
    if (auth?.user) {
      setUser(auth.user);
      Sentry.setUser({ id: auth.user.id });
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

  // Fetch fresh user data via GET /user/me (no token rotation)
  const fetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const response = await api.fetchUser();
      if (response?.user) {
        setUser(response.user);
        lastFetchTime.current = Date.now();
        return response.user;
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
    return null;
  }, []);

  // Refresh user data on tab focus (e.g., returning from Stripe checkout/portal)
  useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      const timeSinceLastFetch = Date.now() - lastFetchTime.current;
      if (timeSinceLastFetch > FOCUS_REFRESH_DEBOUNCE_MS) {
        void fetchUser();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, fetchUser]);

  // Background refresh every 5 minutes as a safety net
  useEffect(() => {
    if (!user) return;

    const intervalId = setInterval(() => {
      void fetchUser();
    }, BACKGROUND_REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [user, fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
    setSessionEndReason(null);
    lastFetchTime.current = Date.now();
    Sentry.setUser({ id: response.user.id });
    return response;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const response = await api.register(email, password);
    setUser(response.user);
    setSessionEndReason(null);
    lastFetchTime.current = Date.now();
    Sentry.setUser({ id: response.user.id });
    return response;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      Sentry.setUser(null);
      router.push('/login');
    }
  }, [router]);

  const refreshUser = useCallback(async () => {
    const response = await api.refreshUser();
    if (response?.user) {
      setUser(response.user);
      lastFetchTime.current = Date.now();
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
    fetchUser,
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
