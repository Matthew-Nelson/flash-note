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
      env.USE_MOCK_AI = 'true';

      const { config } = await import('./config');
      expect(config.DATABASE_URL).toBe('postgres://localhost:5432/flashnote');
    });

    it('should accept postgresql:// prefix', async () => {
      env.DATABASE_URL = 'postgresql://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'true';

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
      env.USE_MOCK_AI = 'true';
      delete env.NODE_ENV;

      const { config } = await import('./config');
      expect(config.NODE_ENV).toBe('development');
    });

    it('should accept valid NODE_ENV values', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.GEMINI_API_KEY = 'test-key';

      const { config } = await import('./config');
      expect(config.NODE_ENV).toBe('test');
    });
  });

  describe('LLM config validation', () => {
    it('should reject USE_MOCK_AI in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.USE_MOCK_AI = 'true';

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should accept USE_MOCK_AI without API key in non-production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'true';
      delete env.GEMINI_API_KEY;

      const { config } = await import('./config');
      expect(config.USE_MOCK_AI).toBe(true);
      expect(config.GEMINI_API_KEY).toBeUndefined();
    });

    it('should parse USE_MOCK_AI=false as boolean false', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'false';
      env.GEMINI_API_KEY = 'test-key';

      const { config } = await import('./config');
      expect(config.USE_MOCK_AI).toBe(false);
    });

    it('should parse GEMINI_USE_ADC=false as boolean false', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_API_KEY = 'test-key';
      env.GEMINI_USE_ADC = 'false';

      const { config } = await import('./config');
      expect(config.GEMINI_USE_ADC).toBe(false);
    });

    it('should reject missing GEMINI_API_KEY when LLM_PROVIDER=gemini', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.LLM_PROVIDER = 'gemini';
      delete env.GEMINI_API_KEY;
      delete env.USE_MOCK_AI;

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should reject missing ANTHROPIC_API_KEY when LLM_PROVIDER=claude', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.LLM_PROVIDER = 'claude';
      delete env.ANTHROPIC_API_KEY;
      delete env.USE_MOCK_AI;

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should accept GEMINI_API_KEY when LLM_PROVIDER=gemini', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_API_KEY = 'test-gemini-key';

      const { config } = await import('./config');
      expect(config.LLM_PROVIDER).toBe('gemini');
      expect(config.GEMINI_API_KEY).toBe('test-gemini-key');
    });

    it('should accept ANTHROPIC_API_KEY when LLM_PROVIDER=claude', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.LLM_PROVIDER = 'claude';
      env.ANTHROPIC_API_KEY = 'test-claude-key';

      const { config } = await import('./config');
      expect(config.LLM_PROVIDER).toBe('claude');
      expect(config.ANTHROPIC_API_KEY).toBe('test-claude-key');
    });

    it('should reject LLM_PROVIDER=claude in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.LLM_PROVIDER = 'claude';
      env.ANTHROPIC_API_KEY = 'test-key';

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should reject direct Gemini API URL in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_API_KEY = 'test-key';
      // Default URL points to generativelanguage.googleapis.com

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should accept Vertex AI URL in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_API_KEY = 'test-key';
      env.GEMINI_API_URL = 'https://us-central1-aiplatform.googleapis.com/v1';
      env.STRIPE_SECRET_KEY = 'sk_test_prod_key';
      env.STRIPE_WEBHOOK_SECRET = 'whsec_prod_secret';
      env.CLEANUP_SECRET = 'a'.repeat(32);

      const { config } = await import('./config');
      expect(config.GEMINI_API_URL).toBe('https://us-central1-aiplatform.googleapis.com/v1');
    });

    it('should accept GEMINI_USE_ADC without GEMINI_API_KEY', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_USE_ADC = 'true';
      delete env.GEMINI_API_KEY;

      const { config } = await import('./config');
      expect(config.GEMINI_USE_ADC).toBe(true);
      expect(config.GEMINI_API_KEY).toBeUndefined();
    });

    it('should accept Vertex AI with ADC in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_USE_ADC = 'true';
      env.GEMINI_API_URL = 'https://us-central1-aiplatform.googleapis.com/v1';
      env.STRIPE_SECRET_KEY = 'sk_test_prod_key';
      env.STRIPE_WEBHOOK_SECRET = 'whsec_prod_secret';
      env.CLEANUP_SECRET = 'a'.repeat(32);
      delete env.GEMINI_API_KEY;

      const { config } = await import('./config');
      expect(config.GEMINI_USE_ADC).toBe(true);
    });

    it('should use default LLM config values', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'true';

      const { config } = await import('./config');
      expect(config.LLM_PROVIDER).toBe('gemini');
      expect(config.GEMINI_MODEL).toBe('gemini-2.5-flash');
      expect(config.GEMINI_MAX_TOKENS).toBe(4000);
      expect(config.GEMINI_TEMPERATURE).toBe(0.2);
      expect(config.GEMINI_TIMEOUT_MS).toBe(30000);
      expect(config.ANTHROPIC_MODEL).toBe('claude-sonnet-4-20250514');
      expect(config.ANTHROPIC_MAX_TOKENS).toBe(2000);
      expect(config.ANTHROPIC_TEMPERATURE).toBe(0.2);
      expect(config.ANTHROPIC_TIMEOUT_MS).toBe(30000);
    });
  });

  describe('Stripe config validation', () => {
    it('should reject missing STRIPE_SECRET_KEY in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_USE_ADC = 'true';
      env.GEMINI_API_URL = 'https://us-central1-aiplatform.googleapis.com/v1';
      env.STRIPE_WEBHOOK_SECRET = 'whsec_prod_secret';
      delete env.STRIPE_SECRET_KEY;

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should reject missing STRIPE_WEBHOOK_SECRET in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_USE_ADC = 'true';
      env.GEMINI_API_URL = 'https://us-central1-aiplatform.googleapis.com/v1';
      env.STRIPE_SECRET_KEY = 'sk_test_prod_key';
      delete env.STRIPE_WEBHOOK_SECRET;

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should accept Stripe keys as optional in non-production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'true';
      delete env.STRIPE_SECRET_KEY;
      delete env.STRIPE_WEBHOOK_SECRET;

      const { config } = await import('./config');
      expect(config.STRIPE_SECRET_KEY).toBeUndefined();
      expect(config.STRIPE_WEBHOOK_SECRET).toBeUndefined();
    });

    it('should reject missing CLEANUP_SECRET in production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'production';
      env.LLM_PROVIDER = 'gemini';
      env.GEMINI_USE_ADC = 'true';
      env.GEMINI_API_URL = 'https://us-central1-aiplatform.googleapis.com/v1';
      env.STRIPE_SECRET_KEY = 'sk_test_prod_key';
      env.STRIPE_WEBHOOK_SECRET = 'whsec_prod_secret';
      delete env.CLEANUP_SECRET;

      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(import('./config')).rejects.toThrow('process.exit called');
      expect(mockExit).toHaveBeenCalledWith(1);

      mockExit.mockRestore();
      mockConsoleError.mockRestore();
    });

    it('should accept missing CLEANUP_SECRET in non-production', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'true';
      delete env.CLEANUP_SECRET;

      const { config } = await import('./config');
      expect(config.CLEANUP_SECRET).toBeUndefined();
    });
  });

  describe('constants', () => {
    it('should export BCRYPT_ROUNDS as 12', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'true';

      const { BCRYPT_ROUNDS } = await import('./config');
      expect(BCRYPT_ROUNDS).toBe(12);
    });

    it('should export LEGAL_DOCUMENT_VERSIONS', async () => {
      env.DATABASE_URL = 'postgres://localhost:5432/flashnote';
      env.NODE_ENV = 'test';
      env.USE_MOCK_AI = 'true';

      const { LEGAL_DOCUMENT_VERSIONS } = await import('./config');
      expect(LEGAL_DOCUMENT_VERSIONS).toEqual({
        baa: '0.1',
        terms_of_service: '0.1',
        privacy_policy: '0.1',
      });
    });
  });
});
