import crypto from 'node:crypto';

// Code generation alphabet: A-Z minus O/I/L (23 letters) + 2-9 (8 digits) = 31 chars
// Excludes ambiguous characters to avoid confusion when sharing verbally
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_SEGMENT_LENGTH = 4;

/**
 * Generate a random code segment of the specified length
 * Uses crypto.randomInt for uniform distribution across the alphabet
 */
function generateSegment(length: number): string {
  let segment = '';
  for (let i = 0; i < length; i++) {
    segment += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return segment;
}

/**
 * Generate a formatted invite code: XXXX-XXXX
 * Does NOT check uniqueness — caller must handle collisions
 */
export function generateCodeString(): string {
  const left = generateSegment(CODE_SEGMENT_LENGTH);
  const right = generateSegment(CODE_SEGMENT_LENGTH);
  return `${left}-${right}`;
}
