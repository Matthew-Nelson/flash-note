import { config } from '../config.js';
import { buildSOAPPrompt, parseSOAPSections } from '../prompts/pt-prompts.js';
import { AppError } from '../middleware/error-handler.js';
import type { GeneratedNote, NoteType } from '../types/index.js';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

class AIService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly temperature: number;
  private readonly timeout: number;

  constructor() {
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = config.GEMINI_API_KEY;
    this.model = config.GEMINI_MODEL;
    this.maxTokens = config.GEMINI_MAX_TOKENS;
    this.temperature = config.GEMINI_TEMPERATURE;
    this.timeout = config.GEMINI_TIMEOUT_MS;
  }

  async generateSOAPNote(
    quickNotes: string,
    noteType: NoteType,
    patientContext?: string
  ): Promise<GeneratedNote> {
    const startTime = Date.now();

    const prompt = buildSOAPPrompt(quickNotes, noteType, patientContext);

    const response = await this.callGemini(prompt);
    const generationTimeMs = Date.now() - startTime;

    const content = response.candidates[0]?.content?.parts[0]?.text;
    if (!content) {
      throw new AppError(500, 'ai_error', 'Failed to generate note: empty response');
    }

    const sections = parseSOAPSections(content);

    return {
      ...sections,
      metadata: {
        model: this.model,
        tokensUsed: response.usageMetadata.totalTokenCount,
        generationTimeMs,
      },
    };
  }

  private async callGemini(prompt: string): Promise<GeminiResponse> {
    const url = `${this.apiUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: this.maxTokens,
            temperature: this.temperature,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        console.error('Gemini API error:', error);
        throw new AppError(500, 'ai_error', 'Failed to generate note');
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AppError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError(500, 'ai_error', 'Note generation timed out');
      }

      console.error('AI service error:', error);
      throw new AppError(500, 'ai_error', 'Failed to generate note');
    }
  }
}

export const aiService = new AIService();
