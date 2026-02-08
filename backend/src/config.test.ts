/**
 * Tests for config.ts ALLOWED_ORIGINS parsing
 *
 * Since config loads at module initialization, we test the Zod transform
 * logic directly using an identical schema definition.
 *
 * IMPORTANT: Keep this schema in sync with config.ts ALLOWED_ORIGINS.
 * If you modify the schema in config.ts, update this test file to match.
 * The schema below should mirror config.ts lines 45-56.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the ALLOWED_ORIGINS schema from config.ts for testing
// SYNC: This must match the schema in config.ts
const allowedOriginsSchema = z
  .string()
  .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean))
  .refine(
    (origins) =>
      origins.every(
        (origin) =>
          /^https?:\/\/.+/.test(origin) || /^chrome-extension:\/\/[a-z]{32}$/.test(origin)
      ),
    {
      message:
        'Each origin must be a valid http(s):// URL or chrome-extension:// URI (32 lowercase letters)',
    }
  )
  .default('http://localhost:3000,http://localhost:5173');

describe('ALLOWED_ORIGINS config parsing', () => {
  describe('comma-separated parsing', () => {
    it('parses single origin', () => {
      const result = allowedOriginsSchema.parse('https://example.com');
      expect(result).toEqual(['https://example.com']);
    });

    it('parses multiple origins', () => {
      const result = allowedOriginsSchema.parse('https://example.com,https://api.example.com');
      expect(result).toEqual(['https://example.com', 'https://api.example.com']);
    });

    it('parses chrome-extension origins with valid 32-char ID', () => {
      const result = allowedOriginsSchema.parse(
        'https://flashnote.co,chrome-extension://abcdefghijklmnopabcdefghijklmnop'
      );
      expect(result).toEqual([
        'https://flashnote.co',
        'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      ]);
    });
  });

  describe('whitespace handling', () => {
    it('trims whitespace from origins', () => {
      const result = allowedOriginsSchema.parse(
        '  https://example.com  ,  https://api.example.com  '
      );
      expect(result).toEqual(['https://example.com', 'https://api.example.com']);
    });

    it('handles newlines in config (common in env files)', () => {
      const result = allowedOriginsSchema.parse('https://example.com,\n  https://api.example.com');
      expect(result).toEqual(['https://example.com', 'https://api.example.com']);
    });
  });

  describe('empty value handling', () => {
    it('filters out empty strings from trailing comma', () => {
      const result = allowedOriginsSchema.parse('https://example.com,');
      expect(result).toEqual(['https://example.com']);
    });

    it('filters out empty strings from leading comma', () => {
      const result = allowedOriginsSchema.parse(',https://example.com');
      expect(result).toEqual(['https://example.com']);
    });

    it('filters out empty strings from consecutive commas', () => {
      const result = allowedOriginsSchema.parse('https://a.com,,https://b.com');
      expect(result).toEqual(['https://a.com', 'https://b.com']);
    });

    it('returns empty array for empty string (passes schema, blocked in production by loadConfig)', () => {
      // Note: Empty array passes Zod validation but is blocked at runtime
      // in production by the loadConfig() check in config.ts
      const result = allowedOriginsSchema.parse('');
      expect(result).toEqual([]);
    });

    it('returns empty array for whitespace only', () => {
      const result = allowedOriginsSchema.parse('   ');
      expect(result).toEqual([]);
    });
  });

  describe('default value', () => {
    it('uses default when value is undefined', () => {
      const result = allowedOriginsSchema.parse(undefined);
      expect(result).toEqual(['http://localhost:3000', 'http://localhost:5173']);
    });
  });

  describe('URL format validation', () => {
    it('rejects invalid protocol (htp://)', () => {
      expect(() => allowedOriginsSchema.parse('htp://typo.com')).toThrow();
    });

    it('rejects javascript: protocol', () => {
      expect(() => allowedOriginsSchema.parse('javascript:alert(1)')).toThrow();
    });

    it('rejects data: protocol', () => {
      expect(() => allowedOriginsSchema.parse('data:text/html,<script>alert(1)</script>')).toThrow();
    });

    it('rejects file: protocol', () => {
      expect(() => allowedOriginsSchema.parse('file:///etc/passwd')).toThrow();
    });

    it('rejects plain strings without protocol', () => {
      expect(() => allowedOriginsSchema.parse('example.com')).toThrow();
    });

    it('rejects chrome-extension with invalid ID length', () => {
      // Extension IDs must be exactly 32 lowercase letters
      expect(() => allowedOriginsSchema.parse('chrome-extension://tooshort')).toThrow();
    });

    it('rejects chrome-extension with uppercase letters', () => {
      expect(() =>
        allowedOriginsSchema.parse('chrome-extension://ABCDEFGHIJKLMNOPABCDEFGHIJKLMNOP')
      ).toThrow();
    });

    it('rejects chrome-extension with numbers', () => {
      expect(() =>
        allowedOriginsSchema.parse('chrome-extension://abcdefghijklmnop1234567890123456')
      ).toThrow();
    });

    it('rejects mixed valid and invalid origins', () => {
      expect(() =>
        allowedOriginsSchema.parse('https://valid.com,invalid-no-protocol')
      ).toThrow();
    });
  });

  describe('production-like configurations', () => {
    it('parses typical production config', () => {
      const result = allowedOriginsSchema.parse(
        'https://flashnote.co,https://www.flashnote.co,chrome-extension://abcdefghijklmnopabcdefghijklmnop'
      );
      expect(result).toEqual([
        'https://flashnote.co',
        'https://www.flashnote.co',
        'chrome-extension://abcdefghijklmnopabcdefghijklmnop',
      ]);
    });

    it('parses development config', () => {
      const result = allowedOriginsSchema.parse(
        'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000'
      );
      expect(result).toEqual([
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
      ]);
    });

    it('accepts URLs with ports', () => {
      const result = allowedOriginsSchema.parse('https://api.example.com:8443');
      expect(result).toEqual(['https://api.example.com:8443']);
    });

    it('accepts URLs with subdomains', () => {
      const result = allowedOriginsSchema.parse('https://app.staging.example.com');
      expect(result).toEqual(['https://app.staging.example.com']);
    });
  });
});
