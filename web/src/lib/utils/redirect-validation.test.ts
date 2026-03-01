import { describe, it, expect } from 'vitest';
import { isAllowedRedirectUrl } from './redirect-validation';

describe('isAllowedRedirectUrl', () => {
  // -------------------------------------------------------------------------
  // Valid Stripe URLs — should be accepted
  // -------------------------------------------------------------------------

  it('accepts valid Stripe checkout URL', () => {
    expect(isAllowedRedirectUrl('https://checkout.stripe.com/c/pay/cs_test_123')).toBe(true);
  });

  it('accepts Stripe checkout URL with query parameters', () => {
    expect(isAllowedRedirectUrl('https://checkout.stripe.com/c/pay/cs_test_123?session_id=abc')).toBe(true);
  });

  it('accepts valid Stripe billing portal URL', () => {
    expect(isAllowedRedirectUrl('https://billing.stripe.com/p/session/test_123')).toBe(true);
  });

  it('accepts Stripe billing portal URL at root path', () => {
    expect(isAllowedRedirectUrl('https://billing.stripe.com/')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // HTTP (non-HTTPS) — must be rejected
  // -------------------------------------------------------------------------

  it('rejects HTTP checkout.stripe.com URL (non-HTTPS)', () => {
    expect(isAllowedRedirectUrl('http://checkout.stripe.com/c/pay/cs_test_123')).toBe(false);
  });

  it('rejects HTTP billing.stripe.com URL (non-HTTPS)', () => {
    expect(isAllowedRedirectUrl('http://billing.stripe.com/p/session/test_123')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Non-Stripe hostnames — must be rejected
  // -------------------------------------------------------------------------

  it('rejects arbitrary HTTPS URL', () => {
    expect(isAllowedRedirectUrl('https://evil.example.com/redirect')).toBe(false);
  });

  it('rejects internal application URL', () => {
    expect(isAllowedRedirectUrl('https://app.flashnote.com/dashboard')).toBe(false);
  });

  it('rejects localhost URL', () => {
    expect(isAllowedRedirectUrl('https://localhost:3000/dashboard')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Stripe-like subdomain attacks — must be rejected
  // -------------------------------------------------------------------------

  it('rejects URL where stripe.com is a subdomain of an attacker domain', () => {
    expect(isAllowedRedirectUrl('https://checkout.stripe.com.evil.com/pay')).toBe(false);
  });

  it('rejects URL where billing.stripe.com is a subdomain of an attacker domain', () => {
    expect(isAllowedRedirectUrl('https://billing.stripe.com.attacker.io/session')).toBe(false);
  });

  it('rejects URL using checkout.stripe.com as a path component', () => {
    expect(isAllowedRedirectUrl('https://evil.com/checkout.stripe.com')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Malformed / empty input — must be rejected
  // -------------------------------------------------------------------------

  it('rejects empty string', () => {
    expect(isAllowedRedirectUrl('')).toBe(false);
  });

  it('rejects garbage string', () => {
    expect(isAllowedRedirectUrl('not-a-url-at-all!!!')).toBe(false);
  });

  it('rejects bare hostname with no protocol', () => {
    expect(isAllowedRedirectUrl('checkout.stripe.com/pay')).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    expect(isAllowedRedirectUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: URI', () => {
    expect(isAllowedRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });
});
