import { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from '@/shared/storage';
import { api, AUTH_INVALIDATED_EVENT } from '@/shared/api';
import { setUser as setSentryUser, captureException } from '@/shared/sentry';

interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  emailVerified?: boolean;
}

// Minimum time between focus-triggered refreshes (30 seconds)
const FOCUS_REFRESH_DEBOUNCE_MS = 30 * 1000;

// Background refresh interval (5 minutes)
const BACKGROUND_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchTime = useRef(0);

  useEffect(() => {
    void loadAuth();
  }, []);

  // Keep Sentry user context in sync (only sends user ID, no PHI)
  useEffect(() => {
    setSentryUser(user?.id ?? null);
  }, [user]);

  // Listen for forced logout (e.g., password reset invalidated token)
  useEffect(() => {
    const handleAuthInvalidated = () => {
      setUser(null);
    };

    window.addEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    return () => {
      window.removeEventListener(AUTH_INVALIDATED_EVENT, handleAuthInvalidated);
    };
  }, []);

  // Fetch fresh user data via GET /user/me (no token rotation)
  const fetchUser = useCallback(async () => {
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

  // Refresh user data on visibility change or focus (e.g., returning from checkout tab)
  // Note: visibilitychange alone doesn't work for sidepanels during tab navigation
  // because the sidepanel stays "visible" while docked. The focus event fires when
  // the user clicks inside the sidepanel after interacting with the main browser area.
  useEffect(() => {
    if (!user) return;

    const handleRefresh = () => {
      const timeSinceLastFetch = Date.now() - lastFetchTime.current;
      if (timeSinceLastFetch > FOCUS_REFRESH_DEBOUNCE_MS) {
        void fetchUser();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleRefresh);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleRefresh);
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

  const loadAuth = async () => {
    try {
      const auth = await storage.getAuth();
      if (auth?.user) {
        setUser(auth.user);
      }
    } catch (error) {
      // Capture to Sentry - helps diagnose extension storage corruption issues
      captureException(error, { source: 'extension_storage', errorType: 'read_failed' });
      console.error('Failed to load auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
    lastFetchTime.current = Date.now();
    return response;
  }, []);

  const register = useCallback(async (email: string, password: string, acceptedLegalTerms: boolean, inviteCode?: string) => {
    const response = await api.register(email, password, acceptedLegalTerms, inviteCode);
    setUser(response.user);
    lastFetchTime.current = Date.now();
    return response;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (error) {
      // Ignore logout errors - clear local state anyway
      console.error('Logout error:', error);
    }
    await storage.clearAuth();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.refreshUser();
      if (response?.user) {
        setUser(response.user);
        lastFetchTime.current = Date.now();
        return response.user;
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
    return null;
  }, []);

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    refreshUser,
    fetchUser,
  };
}
