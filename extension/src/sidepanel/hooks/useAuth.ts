import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/shared/storage';
import { api, AUTH_INVALIDATED_EVENT } from '@/shared/api';

interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
  emailVerified?: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

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

  const loadAuth = async () => {
    try {
      const auth = await storage.getAuth();
      if (auth?.user) {
        setUser(auth.user);
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
    return response;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const response = await api.register(email, password);
    setUser(response.user);
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
  };
}
