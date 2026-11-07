/**
 * Static test inputs for web app E2E tests. Fictional, not PHI.
 */

/**
 * Passwords that each break exactly one rule of the password policy:
 * 8+ characters, an uppercase letter, a lowercase letter, a number.
 */
export const invalidPasswords = {
  tooShort: 'Ab1',
  noUppercase: 'abcdefg1',
  noLowercase: 'ABCDEFG1',
  noNumber: 'Abcdefgh',
};
