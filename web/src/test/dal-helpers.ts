/**
 * Test helpers for DAL unit tests.
 *
 * Provides mock database query functions and factory helpers
 * for creating mock database rows.
 */
import { vi } from 'vitest';

// Type for the mock function signature
type MockQueryFn = (...args: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number }>;

// Mock query functions
export const mockDbQuery = vi.fn<MockQueryFn>();
export const mockClientQuery = vi.fn<MockQueryFn>();

// Mock getPoolClient function (exported for test configuration)
export const mockGetPoolClient = vi.fn();

// Mock the database module
vi.mock('@/server/db', () => ({
  db: {
    query: (...args: unknown[]): Promise<{ rows: unknown[]; rowCount?: number }> =>
      mockDbQuery(...args),
  },
  getPoolClient: (...args: unknown[]): unknown => mockGetPoolClient(...args),
}));

/**
 * Reset all mocks between tests
 */
export function resetMocks() {
  mockDbQuery.mockReset();
  mockClientQuery.mockReset();
  mockGetPoolClient.mockReset();
}

/**
 * Helper to create a mock user row from the database
 */
export function createMockUserRow(overrides: Partial<{
  id: string;
  email: string;
  password_hash: string;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: string;
  trial_ends_at: Date;
  created_at: Date;
  updated_at: Date;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_failed_login_at: Date | null;
  email_verified: boolean;
  email_verified_at: Date | null;
  organization_id: string | null;
  is_deleted: boolean;
  deleted_at: Date | null;
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
    organization_id: null,
    is_deleted: false,
    deleted_at: null,
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

/**
 * Helper to create a mock email token row
 */
export function createMockEmailTokenRow(overrides: Partial<{
  id: string;
  user_id: string;
  token_hash: string;
  token_type: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}> = {}) {
  return {
    id: 'token-uuid',
    user_id: 'test-user-id',
    token_hash: 'abc123tokenhash',
    token_type: 'email_verification',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    used_at: null,
    created_at: new Date(),
    ...overrides,
  };
}

/**
 * Helper to create a mock session+user JOIN row (SessionWithUserRow)
 */
export function createMockSessionWithUserRow(overrides: Partial<{
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  ip_address: string | null;
  user_agent: string | null;
  email: string;
  subscription_status: string;
  trial_ends_at: Date;
  email_verified: boolean;
  organization_id: string | null;
}> = {}) {
  return {
    id: 'session-uuid',
    user_id: 'test-user-id',
    token_hash: 'abc123hash',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    created_at: new Date(),
    ip_address: '127.0.0.1',
    user_agent: 'TestAgent/1.0',
    email: 'test@example.com',
    subscription_status: 'trialing',
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    email_verified: true,
    organization_id: null,
    ...overrides,
  };
}
