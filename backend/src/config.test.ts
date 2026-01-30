/**
 * Tests for config.ts ALLOWED_ORIGINS parsing
 *
 * Since config loads at module initialization, we test the Zod transform
 * logic directly using an identical schema definition.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Mirror the ALLOWED_ORIGINS schema from config.ts for testing
const allowedOriginsSchema = z
  .string()
  .transform((val) => val.split(',').map((origin) => origin.trim()).filter(Boolean))
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

    it('parses chrome-extension origins', () => {
      const result = allowedOriginsSchema.parse(
        'https://flashnote.com,chrome-extension://abcdefghijklmnop'
      );
      expect(result).toEqual([
        'https://flashnote.com',
        'chrome-extension://abcdefghijklmnop',
      ]);
    });
  });

  describe('whitespace handling', () => {
    it('trims whitespace from origins', () => {
      const result = allowedOriginsSchema.parse('  https://example.com  ,  https://api.example.com  ');
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

    it('returns empty array for empty string', () => {
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

  describe('production-like configurations', () => {
    it('parses typical production config', () => {
      const result = allowedOriginsSchema.parse(
        'https://flashnote.com,https://www.flashnote.com,chrome-extension://abcdefghijklmnopabcdefghijklmnop'
      );
      expect(result).toEqual([
        'https://flashnote.com',
        'https://www.flashnote.com',
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
  });
});
