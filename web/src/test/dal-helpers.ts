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

// Mock the database module
vi.mock('@/server/db', () => ({
  db: {
    query: (...args: unknown[]): Promise<{ rows: unknown[]; rowCount?: number }> =>
      mockDbQuery(...args),
  },
  getPoolClient: vi.fn(),
}));

/**
 * Reset all mocks between tests
 */
export function resetMocks() {
  mockDbQuery.mockReset();
  mockClientQuery.mockReset();
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
