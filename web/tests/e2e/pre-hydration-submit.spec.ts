import { test, expect, type Page, type Request } from '@playwright/test';

import { SHARED_USER_STATE } from './fixtures/web';

/**
 * A form submitted before React hydrates falls back to the browser's native
 * submit. Without method="post" that is a GET to the current URL with every
 * named field in the query string, which lands in browser history,
 * load-balancer logs, and Referer headers.
 *
 * Blocking Next's client bundles holds every page in that pre-hydration state.
 * JavaScript stays on rather than being disabled: routes with a loading.tsx
 * stream their content in through inline scripts, which run before hydration
 * in a real browser, so with JavaScript off the form would never appear.
 *
 * Reset-password is absent on purpose: it renders no form until client-side
 * token validation runs, so it can't be submitted before hydration.
 */
test.beforeEach(async ({ page }) => {
  await page.route('**/_next/static/**/*.js', (route) => route.abort());
});

async function submitNatively(page: Page, buttonName: string): Promise<Request> {
  const [request] = await Promise.all([
    page.waitForRequest((req) => req.isNavigationRequest() && req.frame() === page.mainFrame()),
    page.getByRole('button', { name: buttonName }).click(),
  ]);
  return request;
}

function expectPostWithoutQuery(request: Request, path: string): void {
  expect(request.method()).toBe('POST');
  const url = new URL(request.url());
  expect(url.pathname).toBe(path);
  expect(url.search).toBe('');
}

const SECRET_PASSWORD = 'PreHydration1Secret';
const EMAIL = 'pre-hydration-probe@example.com';

test.describe('Auth forms submitted before hydration', () => {
  test('login does not put the password in the URL', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(EMAIL);
    await page.getByLabel('Password').fill(SECRET_PASSWORD);

    expectPostWithoutQuery(await submitNatively(page, 'Sign in'), '/login');
  });

  test('signup does not put the password in the URL', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Email address').fill(EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(SECRET_PASSWORD);
    await page.getByLabel('Confirm Password').fill(SECRET_PASSWORD);

    expectPostWithoutQuery(await submitNatively(page, 'Create account'), '/signup');
  });

  test('forgot-password does not put the email in the URL', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill(EMAIL);

    expectPostWithoutQuery(await submitNatively(page, 'Send reset link'), '/forgot-password');
  });

  test('resend-verification does not put the email in the URL', async ({ page }) => {
    await page.goto('/resend-verification');
    await page.getByLabel('Email address').fill(EMAIL);

    expectPostWithoutQuery(
      await submitNatively(page, 'Send verification email'),
      '/resend-verification',
    );
  });
});

test.describe('PHI forms submitted before hydration', () => {
  test.use({ storageState: SHARED_USER_STATE });

  test('note generation does not put session notes in the URL', async ({ page }) => {
    await page.goto('/dashboard/notes/new');
    await page.getByLabel('Session Notes').fill('Pt reports L knee pain 6/10 after stairs');

    expectPostWithoutQuery(
      await submitNatively(page, 'Generate Professional Note'),
      '/dashboard/notes/new',
    );
  });

  test('patient creation does not put patient details in the URL', async ({ page }) => {
    await page.goto('/dashboard/patients/new');
    await page.getByLabel('First name').fill('Prehydration');
    await page.getByLabel('Last name').fill('Probe');
    await page.getByLabel('Patient context').fill('Post-op TKA, 6 weeks');

    expectPostWithoutQuery(await submitNatively(page, 'Save patient'), '/dashboard/patients/new');
  });
});
