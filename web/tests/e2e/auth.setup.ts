import { test as setup } from '@playwright/test';

import { SHARED_USER_STATE, loginViaUI } from './fixtures/web';
import { createUser } from './helpers/db';

setup('sign in the shared account', async ({ page }) => {
  const user = await createUser({ label: 'shared' });
  await loginViaUI(page, user);
  await page.context().storageState({ path: SHARED_USER_STATE });
});
