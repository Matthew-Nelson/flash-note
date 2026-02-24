import { describe, it, expect } from 'vitest';
import { sanitizeIpAddress } from './request-utils';

describe('sanitizeIpAddress', () => {
  it('should return valid IPv4 address', () => {
    expect(sanitizeIpAddress('192.168.1.1')).toBe('192.168.1.1');
  });

  it('should return valid IPv6 address', () => {
    expect(sanitizeIpAddress('::1')).toBe('::1');
    expect(sanitizeIpAddress('2001:db8::1')).toBe('2001:db8::1');
  });

  it('should return null for invalid IP', () => {
    expect(sanitizeIpAddress('not-an-ip')).toBeNull();
    expect(sanitizeIpAddress('999.999.999.999')).toBeNull();
  });

  it('should return null for undefined', () => {
    expect(sanitizeIpAddress(undefined)).toBeNull();
  });

  it('should return null for null', () => {
    expect(sanitizeIpAddress(null)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(sanitizeIpAddress('')).toBeNull();
  });
});
