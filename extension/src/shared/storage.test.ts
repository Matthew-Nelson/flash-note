import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from './storage';
import { chromeStore } from '@/test/setup';
import { createMockStoredAuth, createMockPreferences } from '@/test/helpers';

describe('Extension Storage', () => {
  beforeEach(() => {
    chromeStore.clear();
  });

  describe('getAuth', () => {
    it('should return null when storage is empty', async () => {
      expect(await storage.getAuth()).toBeNull();
    });

    it('should return stored auth data', async () => {
      const mockAuth = createMockStoredAuth();
      chromeStore.set('auth', mockAuth);
      const result = await storage.getAuth();
      expect(result).not.toBeNull();
      expect(result!.accessToken).toBe(mockAuth.accessToken);
      expect(result!.user.email).toBe(mockAuth.user.email);
    });
  });

  describe('setAuth', () => {
    it('should store auth data', async () => {
      const mockAuth = createMockStoredAuth();
      await storage.setAuth(mockAuth);
      expect(chromeStore.get('auth')).toEqual(mockAuth);
    });

    it('should overwrite existing auth data', async () => {
      await storage.setAuth(createMockStoredAuth());
      const newAuth = createMockStoredAuth({ accessToken: 'new-token' });
      await storage.setAuth(newAuth);
      const stored = chromeStore.get('auth') as { accessToken: string };
      expect(stored.accessToken).toBe('new-token');
    });
  });

  describe('clearAuth', () => {
    it('should remove auth from storage', async () => {
      chromeStore.set('auth', createMockStoredAuth());
      await storage.clearAuth();
      expect(chromeStore.has('auth')).toBe(false);
    });

    it('should not throw when storage is empty', async () => {
      await expect(storage.clearAuth()).resolves.not.toThrow();
    });
  });

  describe('getPreferences', () => {
    it('should return defaults when storage is empty', async () => {
      const prefs = await storage.getPreferences();
      expect(prefs.defaultNoteType).toBe('daily_note');
      expect(prefs.showFloatingBadge).toBe(true);
    });

    it('should return stored preferences', async () => {
      const mockPrefs = createMockPreferences({ showFloatingBadge: false });
      chromeStore.set('preferences', mockPrefs);
      const prefs = await storage.getPreferences();
      expect(prefs.showFloatingBadge).toBe(false);
    });
  });

  describe('setPreferences', () => {
    it('should merge partial preferences with defaults', async () => {
      await storage.setPreferences({ showFloatingBadge: false });
      const prefs = chromeStore.get('preferences') as { defaultNoteType: string; showFloatingBadge: boolean };
      expect(prefs.defaultNoteType).toBe('daily_note');
      expect(prefs.showFloatingBadge).toBe(false);
    });

    it('should merge with existing preferences', async () => {
      chromeStore.set('preferences', createMockPreferences({ defaultNoteType: 'initial_eval' }));
      await storage.setPreferences({ showFloatingBadge: false });
      const prefs = chromeStore.get('preferences') as { defaultNoteType: string; showFloatingBadge: boolean };
      expect(prefs.defaultNoteType).toBe('initial_eval');
      expect(prefs.showFloatingBadge).toBe(false);
    });
  });
});
