import { describe, it, expect } from 'vitest';
import { ApiError } from './api';
import { getErrorMessage, isRateLimited } from './error-messages';

describe('error-messages', () => {
  describe('getErrorMessage', () => {
    it.each([
      ['invalid_credentials', 'Invalid email or password.'],
      ['trial_expired', 'Your free trial has ended.'],
      ['subscription_required', 'An active subscription is required.'],
      ['rate_limit_exceeded', 'Too many attempts. Please try again later.'],
      ['email_not_verified', 'Please verify your email address first.'],
      ['account_locked', 'Account locked due to too many failed attempts. Please try again later.'],
      ['missing_token', 'Your session has expired. Please sign in again.'],
      ['invalid_token', 'Your session has expired. Please sign in again.'],
    ])('should map %s to curated message', (code, expected) => {
      const error = new ApiError(400, code, 'raw backend message');
      expect(getErrorMessage(error)).toBe(expected);
    });

    it('should return default message for unknown ApiError code', () => {
      const error = new ApiError(500, 'some_unknown_code', 'raw backend message');
      expect(getErrorMessage(error)).toBe('Something went wrong. Please try again.');
    });

    it('should return default message for non-ApiError Error', () => {
      expect(getErrorMessage(new Error('raw message'))).toBe('Something went wrong. Please try again.');
    });

    it('should return default message for non-Error values', () => {
      expect(getErrorMessage('string error')).toBe('Something went wrong. Please try again.');
      expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
      expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    });

    it('should never expose raw backend message', () => {
      const error = new ApiError(401, 'invalid_credentials', 'SQL error: SELECT * FROM users WHERE...');
      const message = getErrorMessage(error);
      expect(message).not.toContain('SQL');
      expect(message).toBe('Invalid email or password.');
    });
  });

  describe('isRateLimited', () => {
    it('should return true for rate_limit_exceeded ApiError', () => {
      const error = new ApiError(429, 'rate_limit_exceeded', 'Too many requests');
      expect(isRateLimited(error)).toBe(true);
    });

    it('should return false for other ApiError codes', () => {
      const error = new ApiError(401, 'invalid_credentials', 'Wrong password');
      expect(isRateLimited(error)).toBe(false);
    });

    it('should return false for non-ApiError errors', () => {
      expect(isRateLimited(new Error('Too many'))).toBe(false);
      expect(isRateLimited('rate_limit_exceeded')).toBe(false);
      expect(isRateLimited(null)).toBe(false);
    });
  });
});
