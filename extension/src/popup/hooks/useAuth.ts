import { useState, useEffect, useCallback } from 'react';
import { storage } from '@/shared/storage';
import { api } from '@/shared/api';

interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt?: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
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

  return {
    user,
    isLoading,
    login,
    register,
    logout,
  };
}
