import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { GeminiProvider } from './gemini-provider';
import type { LLMRequestConfig, LLMRetryConfig } from './types';

/**
 * PROMPT-01 — Explicit Gemini safety settings coverage (Plan 04-03 Task 1).
 *
 * Every Gemini request must send explicit `safetySettings` with `BLOCK_ONLY_HIGH`
 * threshold across all four harm categories. `BLOCK_MEDIUM_AND_ABOVE` false-positives
 * on clinical pain/treatment/anatomy content, so we deliberately use BLOCK_ONLY_HIGH.
 *
 * See .planning/phases/04-phi-storage/04-RESEARCH.md §7.1.
 *
 * m-7 fallback: if Vertex AI rejects the string literal 'BLOCK_ONLY_HIGH', the provider
 * may fall back to the SDK's `HarmBlockThreshold.BLOCK_ONLY_HIGH` enum — but must NEVER
 * drop safetySettings or downgrade the threshold.
 */

// Mock logger (mirrors gemini-provider.test.ts pattern so logger imports don't explode)
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
}));
vi.mock('@/server/lib/logger', () => ({ logger: mockLogger }));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const FAST_RETRY_CONFIG: LLMRetryConfig = {
  maxRetries: 1,
  baseDelayMs: 5,
  maxDelayMs: 10,
  retryableErrors: ['rate_limited', 'overloaded', 'network_error', 'timeout', 'provider_error'] as const,
};

const requestConfig: LLMRequestConfig = {
  maxTokens: 2000,
  temperature: 0.7,
  timeoutMs: 30000,
};

const validPTNoteResponse = {
  subjective: 'Patient reports pain 4/10.',
  objective: 'ROM: Knee flexion 110 degrees.',
  assessment: 'Good progress.',
  plan: 'Continue PT 2x/week.',
};

describe('Gemini safety settings (PROMPT-01)', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();

    provider = new GeminiProvider({
      apiKey: 'test-api-key',
      model: 'gemini-2.5-flash',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
      retryConfig: FAST_RETRY_CONFIG,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: { parts: [{ text: JSON.stringify(validPTNoteResponse) }] },
              finishReason: 'STOP',
            },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
        }),
    });
  });

  it('includes safetySettings array with exactly 4 categories', async () => {
    await provider.generatePTNote('test system', 'test user', requestConfig);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse((options as { body: string }).body);

    expect(body.safetySettings).toBeDefined();
    expect(Array.isArray(body.safetySettings)).toBe(true);
    expect(body.safetySettings).toHaveLength(4);

    const categories = (body.safetySettings as { category: string }[])
      .map((s) => s.category)
      .sort();
    expect(categories).toEqual([
      'HARM_CATEGORY_DANGEROUS_CONTENT',
      'HARM_CATEGORY_HARASSMENT',
      'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    ]);
  });

  it('sets every category threshold to BLOCK_ONLY_HIGH (never downgraded)', async () => {
    await provider.generatePTNote('test system', 'test user', requestConfig);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse((options as { body: string }).body);

    const thresholds = (body.safetySettings as { threshold: string }[]).map((s) => s.threshold);

    // m-7: threshold must remain BLOCK_ONLY_HIGH (not BLOCK_NONE, OFF, or MEDIUM_AND_ABOVE)
    expect(thresholds).toHaveLength(4);
    for (const t of thresholds) {
      expect(t).toBe('BLOCK_ONLY_HIGH');
    }
    expect(thresholds).not.toContain('OFF');
    expect(thresholds).not.toContain('BLOCK_NONE');
    expect(thresholds).not.toContain('BLOCK_MEDIUM_AND_ABOVE');
    expect(thresholds).not.toContain('BLOCK_LOW_AND_ABOVE');
  });

  it('sends safetySettings as a sibling of generationConfig (not nested)', async () => {
    await provider.generatePTNote('test system', 'test user', requestConfig);

    const [, options] = mockFetch.mock.calls[0];
    const body = JSON.parse((options as { body: string }).body);

    expect(body.generationConfig).toBeDefined();
    expect(body.safetySettings).toBeDefined();
    // Must NOT be nested inside generationConfig (Vertex AI spec — top-level sibling)
    expect(body.generationConfig.safetySettings).toBeUndefined();
    // Must NOT be nested inside systemInstruction or contents either
    expect(body.systemInstruction.safetySettings).toBeUndefined();
  });

  it('sends safetySettings on every request (not only the first)', async () => {
    await provider.generatePTNote('test system', 'test user', requestConfig);
    await provider.generatePTNote('test system', 'test user', requestConfig);
    await provider.generatePTNote('test system', 'test user', requestConfig);

    expect(mockFetch.mock.calls).toHaveLength(3);
    for (const call of mockFetch.mock.calls) {
      const body = JSON.parse((call[1] as { body: string }).body);
      expect(body.safetySettings).toHaveLength(4);
    }
  });

  it('exposes GEMINI_SAFETY_SETTINGS as a named constant in the provider source', () => {
    // Lint-style assertion: the named constant exists in the source file so it's
    // grep-verifiable (acceptance criterion) and can be audited across the repo.
    const sourcePath = path.resolve(__dirname, 'gemini-provider.ts');
    const source = readFileSync(sourcePath, 'utf8');
    expect(source).toMatch(/GEMINI_SAFETY_SETTINGS/);
    expect(source).toMatch(/HARM_CATEGORY_HARASSMENT/);
    expect(source).toMatch(/HARM_CATEGORY_HATE_SPEECH/);
    expect(source).toMatch(/HARM_CATEGORY_SEXUALLY_EXPLICIT/);
    expect(source).toMatch(/HARM_CATEGORY_DANGEROUS_CONTENT/);
    expect(source).toMatch(/BLOCK_ONLY_HIGH/);
  });
});
