/**
 * Test setup and utilities for vitest
 *
 * This file provides centralized mocking for common dependencies:
 * - Database queries (mockDbQuery)
 * - Audit service (mockAuditLog)
 * - Config values (mockConfig - see below)
 *
 * Usage:
 *   import { mockDbQuery, mockAuditLog, resetMocks } from '../test/setup.js';
 *
 * For config mocking, tests can either:
 * 1. Use the real config (if the test doesn't depend on specific values)
 * 2. Mock specific config values with vi.mock('../config.js', ...) in the test file
 *
 * The second approach is preferred when tests need predictable config values
 * (e.g., token expiry times).
 */
import { vi } from 'vitest';

// Type for the mock function signature (Vitest v4 uses single type parameter)
type MockDbQueryFn = (...args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;

// Mock the database module
export const mockDbQuery = vi.fn<MockDbQueryFn>();

// Mock PoolClient returned by db.connect() - delegates to mockDbQuery for test assertions
export const mockClientQuery = vi.fn<MockDbQueryFn>();
export const mockClientRelease = vi.fn();

const mockClient = {
  query: (...args: unknown[]): Promise<{ rows: unknown[]; rowCount?: number }> =>
    mockClientQuery(...args),
  release: (): void => mockClientRelease(),
};

vi.mock('../db/index.js', () => ({
  db: {
    query: (...args: unknown[]): Promise<{ rows: unknown[]; rowCount?: number }> =>
      mockDbQuery(...args),
    connect: (): Promise<typeof mockClient> => Promise.resolve(mockClient),
  },
}));

// Mock audit service to prevent actual logging during tests
// Must return a Promise since safeAuditLog expects one
type MockAuditLogFn = (...args: unknown[]) => Promise<void>;
export const mockAuditLog = vi.fn<MockAuditLogFn>().mockResolvedValue(undefined);

vi.mock('../services/audit-service.js', () => ({
  auditService: {
    log: (...args: unknown[]): Promise<void> => mockAuditLog(...args),
  },
}));

/**
 * Default test config values
 * Tests can use these when mocking config to ensure consistency
 */
export const TEST_CONFIG_DEFAULTS = {
  JWT_SECRET: 'test-jwt-secret-minimum-32-characters-long',
  JWT_REFRESH_SECRET: 'test-refresh-secret-minimum-32-chars',
  CSRF_SECRET: 'test-csrf-secret-minimum-32-characters',
  EMAIL_VERIFICATION_TOKEN_EXPIRY_HOURS: 24,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: 15,
  WEB_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:4000',
};

/**
 * Reset all mocks between tests
 */
export function resetMocks() {
  mockDbQuery.mockReset();
  mockClientQuery.mockReset();
  mockClientRelease.mockReset();
  mockAuditLog.mockReset();
  // Restore default Promise return value for auditLog
  mockAuditLog.mockResolvedValue(undefined);
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
  organization_id: string | null;
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
    organization_id: null,
    ...overrides,
  };
}

/**
 * Helper to create a mock organization row
 */
export function createMockOrgRow(overrides: Partial<{
  id: string;
  name: string;
  max_seats: number;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: string;
  trial_ends_at: Date | null;
  created_at: Date;
  updated_at: Date;
}> = {}) {
  return {
    id: 'org-uuid',
    name: 'Test Clinic',
    max_seats: 5,
    stripe_customer_id: null,
    subscription_id: null,
    subscription_status: 'active',
    trial_ends_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create a mock organization member row
 */
export function createMockOrgMemberRow(overrides: Partial<{
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  is_billable: boolean;
  joined_at: Date;
  removed_at: Date | null;
}> = {}) {
  return {
    id: 'member-uuid',
    organization_id: 'org-uuid',
    user_id: 'test-user-id',
    role: 'member',
    is_billable: true,
    joined_at: new Date(),
    removed_at: null,
    ...overrides,
  };
}
