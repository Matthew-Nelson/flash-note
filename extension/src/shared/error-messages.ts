import { ApiError } from './api';

const ERROR_CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password.',
  trial_expired: 'Your free trial has ended.',
  subscription_required: 'An active subscription is required.',
  rate_limit_exceeded: 'Too many attempts. Please try again later.',
  email_not_verified: 'Please verify your email address first.',
  account_locked: 'Account locked due to too many failed attempts. Please try again later.',
  missing_token: 'Your session has expired. Please sign in again.',
  invalid_token: 'Your session has expired. Please sign in again.',
};

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Maps an error to a curated user-facing message.
 * Never exposes raw backend error messages to users (CLAUDE.md Rule 2).
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_CODE_MESSAGES[error.code] ?? DEFAULT_ERROR_MESSAGE;
  }
  return DEFAULT_ERROR_MESSAGE;
}

/**
 * Checks whether an error represents a rate limit response.
 * Replaces brittle `err.message.includes('Too many')` checks.
 */
export function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'rate_limit_exceeded';
}
