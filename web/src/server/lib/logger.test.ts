import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import pino from 'pino';
import { Writable } from 'stream';

/**
 * Tests for the Pino logger singleton and request logger.
 *
 * Strategy: Test PHI redaction against a real Pino instance with the same
 * redact config (verifying actual behavior, not mocks). Test the logger
 * singleton creation by importing it under controlled NODE_ENV.
 * Test createRequestLogger with mocked request headers.
 */

// PHI redaction paths -- must match the logger singleton config exactly.
const PHI_PATHS = [
  'patient',
  'patientName',
  'patientData',
  'patientContext',
  'diagnosis',
  'treatment',
  'noteContent',
  'soapNote',
  'quickNotes',
  'shorthand',
  'dateOfBirth',
  'medicalRecordNumber',
  'req.body',
  'res.body',
];

/**
 * Create a test Pino instance that writes to a writable stream,
 * using the same redaction config as the production logger.
 */
function createTestLogger() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });

  const logger = pino(
    {
      level: 'trace',
      redact: {
        paths: PHI_PATHS,
        censor: '[PHI_REDACTED]',
      },
    },
    stream
  );

  return { logger, chunks };
}

describe('logger PHI redaction', () => {
  it('redacts patient field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ patient: 'John Doe' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.patient).toBe('[PHI_REDACTED]');
  });

  it('redacts patientName field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ patientName: 'Jane Smith' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.patientName).toBe('[PHI_REDACTED]');
  });

  it('redacts patientData field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ patientData: { name: 'Test', dob: '1990-01-01' } }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.patientData).toBe('[PHI_REDACTED]');
  });

  it('redacts patientContext field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ patientContext: 'Left knee ACL reconstruction' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.patientContext).toBe('[PHI_REDACTED]');
  });

  it('redacts diagnosis field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ diagnosis: 'ACL tear' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.diagnosis).toBe('[PHI_REDACTED]');
  });

  it('redacts treatment field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ treatment: 'Physical therapy 3x/week' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.treatment).toBe('[PHI_REDACTED]');
  });

  it('redacts noteContent field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ noteContent: 'SOAP note content here' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.noteContent).toBe('[PHI_REDACTED]');
  });

  it('redacts soapNote field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ soapNote: 'S: Patient reports pain...' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.soapNote).toBe('[PHI_REDACTED]');
  });

  it('redacts quickNotes field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ quickNotes: 'pt c/o knee pain...' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.quickNotes).toBe('[PHI_REDACTED]');
  });

  it('redacts shorthand field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ shorthand: 'ROM 90 deg flex' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.shorthand).toBe('[PHI_REDACTED]');
  });

  it('redacts dateOfBirth field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ dateOfBirth: '1985-03-15' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.dateOfBirth).toBe('[PHI_REDACTED]');
  });

  it('redacts medicalRecordNumber field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ medicalRecordNumber: 'MRN-12345' }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.medicalRecordNumber).toBe('[PHI_REDACTED]');
  });

  it('redacts req.body field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ req: { body: 'request body with PHI' } }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.req.body).toBe('[PHI_REDACTED]');
  });

  it('redacts res.body field', () => {
    const { logger, chunks } = createTestLogger();
    logger.info({ res: { body: 'response body with PHI' } }, 'test');
    const output = JSON.parse(chunks[0]);
    expect(output.res.body).toBe('[PHI_REDACTED]');
  });

  it('redacts all PHI paths in a single log entry', () => {
    const { logger, chunks } = createTestLogger();
    logger.info(
      {
        patient: 'John Doe',
        patientName: 'John Doe',
        diagnosis: 'ACL tear',
        treatment: 'PT 3x/week',
        noteContent: 'SOAP note',
        soapNote: 'S: ...',
        quickNotes: 'pt c/o...',
        shorthand: 'ROM 90',
        dateOfBirth: '1985-01-01',
        medicalRecordNumber: 'MRN-123',
        // Non-PHI fields should pass through
        source: 'dal_auth',
        userId: 'user-123',
      },
      'test multiple fields'
    );
    const output = JSON.parse(chunks[0]);
    expect(output.patient).toBe('[PHI_REDACTED]');
    expect(output.patientName).toBe('[PHI_REDACTED]');
    expect(output.diagnosis).toBe('[PHI_REDACTED]');
    expect(output.treatment).toBe('[PHI_REDACTED]');
    expect(output.noteContent).toBe('[PHI_REDACTED]');
    expect(output.soapNote).toBe('[PHI_REDACTED]');
    expect(output.quickNotes).toBe('[PHI_REDACTED]');
    expect(output.shorthand).toBe('[PHI_REDACTED]');
    expect(output.dateOfBirth).toBe('[PHI_REDACTED]');
    expect(output.medicalRecordNumber).toBe('[PHI_REDACTED]');
    // Non-PHI fields preserved
    expect(output.source).toBe('dal_auth');
    expect(output.userId).toBe('user-123');
  });
});

describe('logger singleton', () => {
  it('exports a Pino logger instance with standard API methods', async () => {
    const { logger } = await import('./logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });
});

describe('createRequestLogger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('returns the base logger when no trace header is present', async () => {
    const { createRequestLogger } = await import('./request-logger');
    const { logger } = await import('./logger');

    const mockRequest = {
      headers: new Headers({}),
    } as unknown as import('next/server').NextRequest;

    const result = createRequestLogger(mockRequest);
    expect(result).toBe(logger);
  });

  it('returns the base logger when GOOGLE_CLOUD_PROJECT is not set', async () => {
    delete process.env.GOOGLE_CLOUD_PROJECT;
    const { createRequestLogger } = await import('./request-logger');
    const { logger } = await import('./logger');

    const mockRequest = {
      headers: new Headers({
        'x-cloud-trace-context': 'abc123/def456;o=1',
      }),
    } as unknown as import('next/server').NextRequest;

    const result = createRequestLogger(mockRequest);
    expect(result).toBe(logger);
  });

  it('returns a child logger with trace fields when both header and project ID are present', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';

    // We need to re-import to pick up the env change, but the module is cached.
    // Instead, test the child logger creation logic directly.
    const { createRequestLogger } = await import('./request-logger');
    const { logger } = await import('./logger');

    // Spy on logger.child to verify it's called with correct args
    const childSpy = vi.spyOn(logger, 'child');
    const mockChild = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    childSpy.mockReturnValue(mockChild as unknown as ReturnType<typeof logger.child>);

    const mockRequest = {
      headers: new Headers({
        'x-cloud-trace-context': 'abc123def456/789012;o=1',
      }),
    } as unknown as import('next/server').NextRequest;

    const result = createRequestLogger(mockRequest);
    expect(result).toBe(mockChild);
    expect(childSpy).toHaveBeenCalledWith({
      'logging.googleapis.com/trace': 'projects/my-project/traces/abc123def456',
      'logging.googleapis.com/spanId': '789012',
    });
  });

  it('returns a child logger without spanId when trace header has no span', async () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'my-project';
    const { createRequestLogger } = await import('./request-logger');
    const { logger } = await import('./logger');

    const childSpy = vi.spyOn(logger, 'child');
    const mockChild = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
    childSpy.mockReturnValue(mockChild as unknown as ReturnType<typeof logger.child>);

    const mockRequest = {
      headers: new Headers({
        'x-cloud-trace-context': 'abc123def456',
      }),
    } as unknown as import('next/server').NextRequest;

    const result = createRequestLogger(mockRequest);
    expect(result).toBe(mockChild);
    expect(childSpy).toHaveBeenCalledWith({
      'logging.googleapis.com/trace': 'projects/my-project/traces/abc123def456',
    });
  });
});
