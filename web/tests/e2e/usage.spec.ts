import { test, expect } from '@playwright/test';
import { TEST_USERS } from './helpers/test-data';

/**
 * Usage tracking E2E tests.
 *
 * Tests that usage data is correctly returned by the API
 * for different user types (individual, org member).
 *
 * Requires: `pnpm db:seed:test` to have been run.
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';

test.describe('Usage API', () => {
  test('returns usage data for authenticated user', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: TEST_USERS.PRIMARY.email,
        password: TEST_USERS.PRIMARY.password,
      },
    });
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);

    const { accessToken } = loginBody.data;

    const usageRes = await request.get(`${API_URL}/usage/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(usageRes.status()).toBe(200);
    const usageBody = await usageRes.json();
    expect(usageBody.success).toBe(true);

    // Verify response structure
    expect(usageBody.data).toHaveProperty('currentMonth');
    expect(usageBody.data).toHaveProperty('notesGenerated');
    expect(typeof usageBody.data.currentMonth).toBe('string');
    expect(typeof usageBody.data.notesGenerated).toBe('number');

    // currentMonth should be in YYYY-MM format
    expect(usageBody.data.currentMonth).toMatch(/^\d{4}-\d{2}$/);
  });

  test('unauthenticated usage request returns 401', async ({ request }) => {
    const res = await request.get(`${API_URL}/usage/me`);
    expect(res.status()).toBe(401);
  });
});
