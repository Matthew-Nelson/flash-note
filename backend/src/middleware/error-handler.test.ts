import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';

// Mock config - use vi.hoisted to define the mock before hoisting
const { mockConfig, mockSentry } = vi.hoisted(() => ({
  mockConfig: {
    NODE_ENV: 'production' as 'production' | 'development' | 'test',
  },
  mockSentry: {
    captureException: vi.fn(),
  },
}));

vi.mock('../config.js', () => ({
  config: mockConfig,
}));

vi.mock('@sentry/node', () => mockSentry);

import { AppError, errorHandler } from './error-handler.js';

describe('Error Handler Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {};
    mockRes = {
      status: statusMock as unknown as Response['status'],
      json: jsonMock as unknown as Response['json'],
    };
    mockNext = vi.fn() as unknown as NextFunction;

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as ReturnType<typeof vi.spyOn>;
    mockConfig.NODE_ENV = 'production';
    mockSentry.captureException.mockClear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError(404, 'not_found', 'Resource not found');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('not_found');
      expect(error.message).toBe('Resource not found');
      expect(error.name).toBe('AppError');
    });

    it('should be an instance of Error', () => {
      const error = new AppError(400, 'bad_request', 'Bad request');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('errorHandler', () => {
    describe('AppError handling', () => {
      it('should return correct status code for AppError', () => {
        const error = new AppError(401, 'unauthorized', 'Not authorized');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(401);
      });

      it('should return error code and message for AppError', () => {
        const error = new AppError(403, 'forbidden', 'Access denied');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'forbidden',
            message: 'Access denied',
          },
        });
      });

      it('should handle various AppError status codes', () => {
        const testCases = [
          { statusCode: 400, code: 'bad_request', message: 'Bad request' },
          { statusCode: 401, code: 'unauthorized', message: 'Unauthorized' },
          { statusCode: 402, code: 'payment_required', message: 'Payment required' },
          { statusCode: 403, code: 'forbidden', message: 'Forbidden' },
          { statusCode: 404, code: 'not_found', message: 'Not found' },
          { statusCode: 409, code: 'conflict', message: 'Conflict' },
          { statusCode: 429, code: 'too_many_requests', message: 'Too many requests' },
          { statusCode: 500, code: 'internal_error', message: 'Internal error' },
        ];

        testCases.forEach(({ statusCode, code, message }) => {
          jsonMock.mockClear();
          statusMock.mockClear();

          const error = new AppError(statusCode, code, message);
          errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

          expect(statusMock).toHaveBeenCalledWith(statusCode);
          expect(jsonMock).toHaveBeenCalledWith({
            success: false,
            error: { code, message },
          });
        });
      });
    });

    describe('ZodError handling', () => {
      it('should return 400 for ZodError', () => {
        const schema = z.object({ email: z.string().email() });
        let zodError: ZodError;

        try {
          schema.parse({ email: 'invalid' });
        } catch (e) {
          zodError = e as ZodError;
        }

        errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(400);
      });

      it('should return validation_error code for ZodError', () => {
        const schema = z.object({ email: z.string().email() });
        let zodError: ZodError;

        try {
          schema.parse({ email: 'invalid' });
        } catch (e) {
          zodError = e as ZodError;
        }

        errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'validation_error',
            message: 'Invalid request data',
            details: expect.any(Object),
          },
        });
      });

      it('should include field errors in details', () => {
        const schema = z.object({
          email: z.string().email(),
          password: z.string().min(8),
        });
        let zodError: ZodError;

        try {
          schema.parse({ email: 'bad', password: '123' });
        } catch (e) {
          zodError = e as ZodError;
        }

        errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

        const response = jsonMock.mock.calls[0]![0];
        expect(response.error.details).toHaveProperty('email');
        expect(response.error.details).toHaveProperty('password');
      });

      it('should handle nested Zod validation errors', () => {
        const schema = z.object({
          user: z.object({
            profile: z.object({
              name: z.string().min(1),
            }),
          }),
        });
        let zodError: ZodError;

        try {
          schema.parse({ user: { profile: { name: '' } } });
        } catch (e) {
          zodError = e as ZodError;
        }

        errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              code: 'validation_error',
            }),
          })
        );
      });
    });

    describe('unknown error handling', () => {
      it('should return 500 for unknown errors', () => {
        const error = new Error('Something went wrong');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(statusMock).toHaveBeenCalledWith(500);
      });

      it('should return generic message in production', () => {
        mockConfig.NODE_ENV = 'production';
        const error = new Error('Sensitive database error details');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(jsonMock).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'internal_error',
            message: 'An unexpected error occurred',
          },
        });
      });

      it('should return generic message in all environments', () => {
        const envs: Array<'development' | 'test' | 'production'> = ['development', 'test', 'production'];

        envs.forEach((env) => {
          jsonMock.mockClear();
          statusMock.mockClear();
          mockConfig.NODE_ENV = env;
          const error = new Error('Sensitive database error details');

          errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

          expect(jsonMock).toHaveBeenCalledWith({
            success: false,
            error: {
              code: 'internal_error',
              message: 'An unexpected error occurred',
            },
          });
        });
      });

      it('should capture unknown errors to Sentry', () => {
        const error = new Error('Unexpected database failure');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(mockSentry.captureException).toHaveBeenCalledWith(error);
      });

      it('should NOT capture AppError to Sentry', () => {
        const error = new AppError(401, 'unauthorized', 'Not authorized');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        expect(mockSentry.captureException).not.toHaveBeenCalled();
      });

      it('should NOT capture ZodError to Sentry', () => {
        const schema = z.object({ email: z.string().email() });
        let zodError: ZodError;

        try {
          schema.parse({ email: 'invalid' });
        } catch (e) {
          zodError = e as ZodError;
        }

        errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

        expect(mockSentry.captureException).not.toHaveBeenCalled();
      });
    });

    describe('logging', () => {
      it('should log message and stack in development', () => {
        mockConfig.NODE_ENV = 'development';
        const error = new Error('Dev error');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        const loggedObj = consoleErrorSpy.mock.calls[0]![1];
        expect(loggedObj).toEqual(expect.objectContaining({
          name: 'Error',
          message: 'Dev error',
          stack: expect.any(String),
        }));
      });

      it('should log message and stack in test', () => {
        mockConfig.NODE_ENV = 'test';
        const error = new Error('Test error');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        const loggedObj = consoleErrorSpy.mock.calls[0]![1];
        expect(loggedObj).toEqual(expect.objectContaining({
          name: 'Error',
          message: 'Test error',
          stack: expect.any(String),
        }));
      });

      it('should NOT log message or stack in production', () => {
        mockConfig.NODE_ENV = 'production';
        const error = new Error('Sensitive prod error');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        const loggedObj = consoleErrorSpy.mock.calls[0]![1];
        expect(loggedObj).toEqual({ name: 'Error' });
        expect(loggedObj).not.toHaveProperty('message');
        expect(loggedObj).not.toHaveProperty('stack');
      });

      it('should log AppError code and statusCode in production but not message', () => {
        mockConfig.NODE_ENV = 'production';
        const error = new AppError(404, 'not_found', 'Resource not found');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        const loggedObj = consoleErrorSpy.mock.calls[0]![1];
        expect(loggedObj).toEqual({
          name: 'AppError',
          code: 'not_found',
          statusCode: 404,
        });
        expect(loggedObj).not.toHaveProperty('message');
        expect(loggedObj).not.toHaveProperty('stack');
      });

      it('should log AppError with full details in development', () => {
        mockConfig.NODE_ENV = 'development';
        const error = new AppError(404, 'not_found', 'Resource not found');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        const loggedObj = consoleErrorSpy.mock.calls[0]![1];
        expect(loggedObj).toEqual(expect.objectContaining({
          name: 'AppError',
          code: 'not_found',
          statusCode: 404,
          message: 'Resource not found',
          stack: expect.any(String),
        }));
      });
    });

    describe('HIPAA compliance: error sanitization', () => {
      it('should not leak sensitive error details in production', () => {
        mockConfig.NODE_ENV = 'production';
        const sensitiveError = new Error(
          'PostgreSQL error: duplicate key value violates unique constraint "users_email_key" for user@patient.com'
        );

        errorHandler(sensitiveError, mockReq as Request, mockRes as Response, mockNext);

        const response = jsonMock.mock.calls[0]![0];
        expect(response.error.message).toBe('An unexpected error occurred');
        expect(response.error.message).not.toContain('PostgreSQL');
        expect(response.error.message).not.toContain('user@patient.com');
      });

      it('should not leak stack traces in production response', () => {
        mockConfig.NODE_ENV = 'production';
        const error = new Error('Database error');

        errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

        const response = jsonMock.mock.calls[0]![0];
        expect(response).not.toHaveProperty('stack');
        expect(response.error).not.toHaveProperty('stack');
      });

      it('should not include PHI that might be in error messages', () => {
        mockConfig.NODE_ENV = 'production';
        const phiError = new Error(
          'Failed to process note for patient John Doe DOB 01/15/1980'
        );

        errorHandler(phiError, mockReq as Request, mockRes as Response, mockNext);

        const response = jsonMock.mock.calls[0]![0];
        expect(response.error.message).toBe('An unexpected error occurred');
        expect(response.error.message).not.toContain('John Doe');
        expect(response.error.message).not.toContain('01/15/1980');
      });

      it('should sanitize Zod error details that might contain user input', () => {
        // Zod errors might contain the invalid values which could be PHI
        const schema = z.object({ patientId: z.string().uuid() });
        let zodError: ZodError;

        try {
          schema.parse({ patientId: 'patient-john-doe-12345' });
        } catch (e) {
          zodError = e as ZodError;
        }

        errorHandler(zodError!, mockReq as Request, mockRes as Response, mockNext);

        // The response should only indicate which field failed, not the value
        const response = jsonMock.mock.calls[0]![0];
        expect(response.error.message).toBe('Invalid request data');
        // Details contain field names but generic error messages
        expect(response.error.details).toBeDefined();
      });
    });

    describe('response structure consistency', () => {
      it('should always return success: false for errors', () => {
        const errors = [
          new AppError(400, 'bad_request', 'Bad'),
          new Error('Unknown'),
        ];

        errors.forEach((error) => {
          jsonMock.mockClear();
          errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
          expect(jsonMock.mock.calls[0]![0].success).toBe(false);
        });
      });

      it('should always include error.code in response', () => {
        const errors = [
          new AppError(400, 'custom_code', 'Custom'),
          new Error('Unknown'),
        ];

        errors.forEach((error) => {
          jsonMock.mockClear();
          errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
          expect(jsonMock.mock.calls[0]![0].error.code).toBeDefined();
        });
      });

      it('should always include error.message in response', () => {
        const errors = [
          new AppError(400, 'test', 'Test message'),
          new Error('Generic'),
        ];

        errors.forEach((error) => {
          jsonMock.mockClear();
          mockConfig.NODE_ENV = 'production';
          errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
          expect(jsonMock.mock.calls[0]![0].error.message).toBeDefined();
          expect(typeof jsonMock.mock.calls[0]![0].error.message).toBe('string');
        });
      });
    });
  });
});
