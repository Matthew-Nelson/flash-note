/**
 * Test data helpers for web app E2E tests.
 *
 * Contains generated credentials, invalid inputs, and other test data.
 * These are NOT PHI - they're fictional examples for testing.
 */

/**
 * Generate a unique email for registration tests.
 * Uses timestamp + random suffix to ensure uniqueness.
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Generate a valid test password that meets policy requirements:
 * - Min 8 characters
 * - At least one uppercase
 * - At least one lowercase
 * - At least one number
 */
export function generateTestPassword(): string {
  return `TestPass${Date.now().toString().slice(-4)}!`;
}

/**
 * Invalid email examples for validation testing.
 */
export const invalidEmails = {
  noAt: 'invalidemail.com',
  noDomain: 'user@',
  noUser: '@domain.com',
  empty: '',
};

/**
 * Invalid password examples for validation testing.
 */
export const invalidPasswords = {
  tooShort: 'Ab1',
  noUppercase: 'abcdefg1',
  noLowercase: 'ABCDEFG1',
  noNumber: 'Abcdefgh',
  empty: '',
};

/**
 * Valid test credentials for forms.
 */
export const validCredentials = {
  email: 'newuser@example.com',
  password: 'ValidPass123',
  confirmPassword: 'ValidPass123',
};
