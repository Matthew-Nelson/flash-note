/**
 * Test setup and utilities for vitest
 */
import { vi } from 'vitest';

// Mock the database module
export const mockDbQuery = vi.fn();

vi.mock('../db/index.js', () => ({
  db: {
    query: (...args: unknown[]) => mockDbQuery(...args),
  },
}));

// Mock audit service to prevent actual logging during tests
export const mockAuditLog = vi.fn();

vi.mock('../services/audit-service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
  },
}));

/**
 * Reset all mocks between tests
 */
export function resetMocks() {
  mockDbQuery.mockReset();
  mockAuditLog.mockReset();
}

/**
 * Helper to create a mock user row from the database
 */
export function createMockUserRow(overrides: Partial<{
  id: string;
  email: string;
  password_hash: string;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_failed_login_at: Date | null;
  email_verified: boolean;
  email_verified_at: Date | null;
  token_version: number;
}> = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYq1IpHBBUGK',
    stripe_customer_id: null,
    subscription_id: null,
    subscription_status: 'trialing',
    trial_ends_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    failed_login_attempts: 0,
    locked_until: null,
    last_failed_login_at: null,
    email_verified: true,
    email_verified_at: new Date(),
    token_version: 1,
    ...overrides,
  };
}
