import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use a mutable env type to allow assignment in tests
const env = process.env as Record<string, string | undefined>;

describe('Server Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Restore original env values
    for (const key of Object.keys(env)) {
      if (!(key in originalEnv)) delete env[key];
    }
    Object.assign(env, originalEnv);
  });

  afterEach(() => {
    // Restore original env values
    for (const key of Object.keys(env)) {
      if (!(key in originalEnv)) delete env[key];
    }
    Object.assign(env, originalEnv);
  });

  // L-7 fix: DATABASE_URL must start with postgres:// or postgresql://
  describe('DATABASE_URL validation', () => {
    it('should accept postgres:// prefix', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';

      const { config } = await import('./config');
      expect(config.DATABASE_URL).toBe('postgres://localhost:5432/flashnote');
    });

    it('should accept postgresql:// prefix', async () => {
      env.DATABASE_URL = 'postgresql://localhost:5432/flashnote';
      env.NODE_ENV = 'test';

      const { config } = await import('./config');
      expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/flashnote');
    });

    it('should reject non-postgres URLs', async () => {
      env.DATABASE_URL = 'mysql://localhost:3306/flashnote';
      env.NODE_ENV = 'test';

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should reject plain URLs without postgres prefix', async () => {
      env.DATABASE_URL = 'https://db.example.com/flashnote';
      env.NODE_ENV = 'test';

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should reject missing DATABASE_URL', async () => {
      delete env.DATABASE_URL;
      env.NODE_ENV = 'test';

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });
  });

  describe('NODE_ENV validation', () => {
    it('should default to development when not set', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      delete env.NODE_ENV;

      const { config } = await import('./config');
      expect(config.NODE_ENV).toBe('development');
    });

    it('should accept valid NODE_ENV values', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';

      const { config } = await import('./config');
      expect(config.NODE_ENV).toBe('production');
    });
  });

  describe('constants', () => {
    it('should export BCRYPT_ROUNDS as 12', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';

      const { BCRYPT_ROUNDS } = await import('./config');
      expect(BCRYPT_ROUNDS).toBe(12);
    });

    it('should export LEGAL_DOCUMENT_VERSIONS', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';

      const { LEGAL_DOCUMENT_VERSIONS } = await import('./config');
      expect(LEGAL_DOCUMENT_VERSIONS).toEqual({
        baa: '0.1',
        terms_of_service: '0.1',
        privacy_policy: '0.1',
      });
    });
  });
});
