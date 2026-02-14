import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_INVITE_CODE } from './helpers/test-data';

/**
 * Organization flow E2E tests.
 *
 * Tests the org invite code flow and org subscription fallback
 * via direct API calls against the running backend.
 *
 * Requires: `pnpm db:seed:test` to have been run (seeded org + invite codes).
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';

test.describe('Organization Join Flow', () => {
  test('org member has organization context in usage response', async ({ request }) => {
    // Login as existing org member
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: TEST_USERS.ORG_MEMBER.email,
        password: TEST_USERS.ORG_MEMBER.password,
      },
    });
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);

    const { accessToken } = loginBody.data;

    // Fetch usage — should include organization context
    const usageRes = await request.get(`${API_URL}/usage/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(usageRes.status()).toBe(200);

    const usageBody = await usageRes.json();
    expect(usageBody.success).toBe(true);
    expect(usageBody.data.organization).not.toBeNull();
    expect(usageBody.data.organization.name).toBe('Test Physical Therapy Clinic');
    expect(usageBody.data.organization.role).toBe('member');
  });

  test('org owner has owner role in usage response', async ({ request }) => {
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: TEST_USERS.ORG_OWNER.email,
        password: TEST_USERS.ORG_OWNER.password,
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
    expect(usageBody.data.organization).not.toBeNull();
    expect(usageBody.data.organization.role).toBe('owner');
  });

  test('non-org user has null organization in usage response', async ({ request }) => {
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
    expect(usageBody.data.organization).toBeNull();
  });

  test('joining org with used invite code fails', async ({ request }) => {
    // Login as a user not in an org
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: TEST_USERS.PRIMARY.email,
        password: TEST_USERS.PRIMARY.password,
      },
    });
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);

    const { accessToken, csrfToken } = loginBody.data;

    // Try to join with an already-used invite code
    const joinRes = await request.post(`${API_URL}/organization/join`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-csrf-token': csrfToken,
      },
      data: { inviteCode: 'USEDCODE01' },
    });

    expect(joinRes.status()).toBe(400);
    const joinBody = await joinRes.json();
    expect(joinBody.success).toBe(false);
    expect(joinBody.error.code).toBe('invalid_invite_code');
  });

  test('joining org when already a member fails', async ({ request }) => {
    // Login as org owner (already in an org)
    const loginRes = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: TEST_USERS.ORG_OWNER.email,
        password: TEST_USERS.ORG_OWNER.password,
      },
    });
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);

    const { accessToken, csrfToken } = loginBody.data;

    // Try to join with a valid invite code — should fail because already in org
    const joinRes = await request.post(`${API_URL}/organization/join`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-csrf-token': csrfToken,
      },
      data: { inviteCode: TEST_INVITE_CODE },
    });

    expect(joinRes.status()).toBe(409);
    const joinBody = await joinRes.json();
    expect(joinBody.success).toBe(false);
    expect(joinBody.error.code).toBe('already_in_organization');
  });

  test('invite code validation endpoint returns valid for active code', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/invite-codes/validate`, {
      data: { code: TEST_INVITE_CODE },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
  });

  test('invite code validation rejects used code', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/invite-codes/validate`, {
      data: { code: 'USEDCODE01' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    // Used codes should not be valid
    expect(body.data.valid).toBe(false);
  });
});
