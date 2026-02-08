import { describe, it, expect } from 'vitest';
import {
  isPHIField,
  sanitizeObject,
  sanitizeUrl,
  PHI_FIELD_PATTERNS,
} from './sentry-sanitization';

describe('Sentry PHI Sanitization', () => {
  describe('PHI_FIELD_PATTERNS', () => {
    it('should have patterns for common PHI field names', () => {
      expect(PHI_FIELD_PATTERNS.length).toBeGreaterThan(0);
      expect(PHI_FIELD_PATTERNS.every((p) => p instanceof RegExp)).toBe(true);
    });
  });

  describe('isPHIField', () => {
    describe('should identify PHI fields', () => {
      const phiFields = [
        'patient',
        'patientName',
        'patient_id',
        'PATIENT',
        'diagnosis',
        'treatment',
        'medical',
        'medicalRecord',
        'health',
        'healthInfo',
        'dob',
        'dateOfBirth',
        'date_of_birth',
        'ssn',
        'socialSecurity',
        'social_security_number',
        'mrn',
        'medicalRecordNumber',
        'note',
        'noteContent',
        'soap',
        'soapNote',
        'assessment',
        'subjective',
        'objective',
        'plan',
        'shorthand',
        'input',
        'content',
        'body',
        'message',
        'requestBody',
        'messageContent',
      ];

      phiFields.forEach((field) => {
        it(`should flag "${field}" as PHI`, () => {
          expect(isPHIField(field)).toBe(true);
        });
      });
    });

    describe('should NOT flag safe fields', () => {
      const safeFields = [
        'id',
        'userId',
        'email',
        'timestamp',
        'createdAt',
        'status',
        'error',
        'code',
        'path',
        'method',
        'duration',
        'count',
        'version',
        'environment',
      ];

      safeFields.forEach((field) => {
        it(`should NOT flag "${field}" as PHI`, () => {
          expect(isPHIField(field)).toBe(false);
        });
      });
    });
  });

  describe('sanitizeObject', () => {
    it('should redact PHI fields at top level', () => {
      const input = {
        userId: '123',
        patientName: 'John Doe',
        email: 'test@example.com',
      };
      const result = sanitizeObject(input);
      expect(result.userId).toBe('123');
      expect(result.patientName).toBe('[REDACTED - PHI]');
      expect(result.email).toBe('test@example.com');
    });

    it('should redact PHI fields in nested objects', () => {
      const input = {
        user: {
          id: '123',
          data: {
            diagnosis: 'Some diagnosis',
            status: 'active',
          },
        },
      };
      const result = sanitizeObject(input);
      expect((result.user as Record<string, unknown>).id).toBe('123');
      expect(
        ((result.user as Record<string, unknown>).data as Record<string, unknown>).diagnosis
      ).toBe('[REDACTED - PHI]');
      expect(
        ((result.user as Record<string, unknown>).data as Record<string, unknown>).status
      ).toBe('active');
    });

    it('should redact PHI fields in arrays of objects', () => {
      const input = {
        items: [
          { id: 1, treatment: 'Treatment A' },
          { id: 2, treatment: 'Treatment B' },
        ],
      };
      const result = sanitizeObject(input);
      const items = result.items as Array<Record<string, unknown>>;
      expect(items[0].id).toBe(1);
      expect(items[0].treatment).toBe('[REDACTED - PHI]');
      expect(items[1].id).toBe(2);
      expect(items[1].treatment).toBe('[REDACTED - PHI]');
    });

    it('should preserve primitive values in arrays', () => {
      const input = {
        tags: ['error', 'production', 'api'],
        counts: [1, 2, 3],
      };
      const result = sanitizeObject(input);
      expect(result.tags).toEqual(['error', 'production', 'api']);
      expect(result.counts).toEqual([1, 2, 3]);
    });

    it('should handle empty objects', () => {
      expect(sanitizeObject({})).toEqual({});
    });

    it('should handle null and undefined values', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        validValue: 'test',
      };
      const result = sanitizeObject(input);
      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(result.validValue).toBe('test');
    });

    it('should handle deeply nested structures', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              level4: {
                safeField: 'safe',
                patientData: 'sensitive',
              },
            },
          },
        },
      };
      const result = sanitizeObject(input);
      const deep = (
        ((result.level1 as Record<string, unknown>).level2 as Record<string, unknown>)
          .level3 as Record<string, unknown>
      ).level4 as Record<string, unknown>;
      expect(deep.safeField).toBe('safe');
      expect(deep.patientData).toBe('[REDACTED - PHI]');
    });

    it('should handle mixed arrays with objects and primitives', () => {
      const input = {
        mixed: [
          'string',
          123,
          { noteContent: 'sensitive' },
          null,
          { safeKey: 'value' },
        ],
      };
      const result = sanitizeObject(input);
      const mixed = result.mixed as unknown[];
      expect(mixed[0]).toBe('string');
      expect(mixed[1]).toBe(123);
      expect((mixed[2] as Record<string, unknown>).noteContent).toBe('[REDACTED - PHI]');
      expect(mixed[3]).toBeNull();
      expect((mixed[4] as Record<string, unknown>).safeKey).toBe('value');
    });
  });

  describe('sanitizeUrl', () => {
    it('should remove query parameters from URL', () => {
      const url = 'https://api.example.com/users?patientId=123&name=John';
      expect(sanitizeUrl(url)).toBe('https://api.example.com/users');
    });

    it('should preserve path without query params', () => {
      expect(sanitizeUrl('https://api.example.com/health')).toBe(
        'https://api.example.com/health'
      );
    });

    it('should handle URLs with fragments', () => {
      const url = 'https://example.com/page?query=value#section';
      expect(sanitizeUrl(url)).toBe('https://example.com/page#section');
    });

    it('should return [REDACTED] for invalid URLs', () => {
      expect(sanitizeUrl('not-a-valid-url')).toBe('[REDACTED]');
    });

    it('should return [REDACTED] for empty string', () => {
      expect(sanitizeUrl('')).toBe('[REDACTED]');
    });

    it('should handle URLs with ports', () => {
      const url = 'http://localhost:4000/api/notes?content=sensitive';
      expect(sanitizeUrl(url)).toBe('http://localhost:4000/api/notes');
    });
  });

  describe('HIPAA compliance scenarios', () => {
    it('should sanitize a realistic Sentry extra object', () => {
      const extra = {
        userId: 'user-123',
        requestPath: '/api/notes/generate',
        patientContext: 'John Doe, 45yo male, knee pain',
        shorthandInput: 'pt c/o knee pain x2wks',
        documentType: 'daily_note',
        timestamp: '2024-01-15T10:30:00Z',
      };
      const result = sanitizeObject(extra);
      expect(result.userId).toBe('user-123');
      expect(result.requestPath).toBe('/api/notes/generate');
      expect(result.patientContext).toBe('[REDACTED - PHI]');
      expect(result.shorthandInput).toBe('[REDACTED - PHI]');
      expect(result.documentType).toBe('daily_note');
      expect(result.timestamp).toBe('2024-01-15T10:30:00Z');
    });

    it('should sanitize realistic breadcrumb data', () => {
      const breadcrumbData = {
        url: 'https://api.flashnote.co/notes?patientId=123',
        method: 'POST',
        status_code: 200,
        body: '{"shorthand": "pt reports pain..."}',
        requestBody: '{"diagnosis": "..."}',
      };
      const result = sanitizeObject(breadcrumbData);
      expect(result.method).toBe('POST');
      expect(result.status_code).toBe(200);
      expect(result.body).toBe('[REDACTED - PHI]');
      expect(result.requestBody).toBe('[REDACTED - PHI]');
    });
  });
});
