import { test, expect, type Page } from '@playwright/test';

import { fill, signInNewUser } from './fixtures/web';
import { createNote, uniqueWord } from './helpers/db';

/**
 * Note workflows: generation (USE_MOCK_AI on the e2e server), subscription
 * gating, PHI clearing on logout, and the saved-notes list, search and detail.
 *
 * Saved notes are inserted through the DB helper: no UI control calls
 * saveNoteAction yet, so the list can't be populated through the app.
 */

// First line of the mock generator's Subjective section (services/note-generation.ts)
const MOCK_SUBJECTIVE = 'Patient reports pain level of 4/10 at rest';

async function generateNote(page: Page, quickNotes: string): Promise<void> {
  await page.goto('/dashboard/notes/new');
  await fill(page.getByLabel('Session Notes'), quickNotes);
  await page.getByRole('button', { name: 'Generate Professional Note' }).click();
}

test.describe('Note generation', () => {
  test('generates a SOAP note and counts it toward monthly usage', async ({ page }) => {
    await signInNewUser(page, { label: 'generate' });
    await expect(page.getByRole('main')).toContainText(/Notes This Month\s*0(?!\d)/);

    await generateNote(page, 'Pt reports L knee pain 5/10, AROM flex 95, manual therapy + ther ex');

    await expect(page.getByText(MOCK_SUBJECTIVE)).toBeVisible();
    for (const section of ['Subjective', 'Objective', 'Assessment', 'Plan']) {
      await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Copy full SOAP note' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page.getByRole('main')).toContainText(/Notes This Month\s*1(?!\d)/);
  });

  test('rejects empty session notes without generating', async ({ page }) => {
    await signInNewUser(page, { label: 'generate-empty' });
    await page.goto('/dashboard/notes/new');

    await page.getByRole('button', { name: 'Generate Professional Note' }).click();

    await expect(page.getByText('Please check your input and try again.')).toBeVisible();
    await expect(page.getByText(MOCK_SUBJECTIVE)).toHaveCount(0);
  });

  test('an expired trial is blocked from generating', async ({ page }) => {
    await signInNewUser(page, { label: 'generate-expired', trialEndsAt: new Date(Date.now() - 60_000) });

    await generateNote(page, 'Pt reports L knee pain 5/10');

    await expect(page.getByText('Your free trial has ended. Please subscribe to continue.')).toBeVisible();
    await expect(page.getByText(MOCK_SUBJECTIVE)).toHaveCount(0);
  });

  test('a canceled subscription is blocked from generating', async ({ page }) => {
    await signInNewUser(page, { label: 'generate-canceled', subscriptionStatus: 'canceled' });

    await generateNote(page, 'Pt reports L knee pain 5/10');

    await expect(page.getByText('An active subscription is required to generate notes.')).toBeVisible();
    await expect(page.getByText(MOCK_SUBJECTIVE)).toHaveCount(0);
  });

  test('signing out clears the generated note, and Back does not bring it back (Rule 4)', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'phi-logout' });
    const shorthand = `Pt ${uniqueWord('marker')} reports knee pain`;
    await generateNote(page, shorthand);
    await expect(page.getByText(MOCK_SUBJECTIVE)).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');

    await page.goBack();
    await expect(page).toHaveURL('/login');
    await expect(page.getByText(MOCK_SUBJECTIVE)).toHaveCount(0);

    // Signing back in starts from an empty form, not the previous session's input
    await fill(page.getByLabel('Email address'), user.email);
    await fill(page.getByLabel('Password'), user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');
    await page.goto('/dashboard/notes/new');
    await expect(page.getByLabel('Session Notes')).toHaveValue('');
  });
});

test.describe('Saved notes', () => {
  test('the notes list shows a saved note and search narrows it', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'notes-list' });
    const knee = uniqueWord('knee');
    const shoulder = uniqueWord('shoulder');
    await createNote(user.id, { subjective: `Reports ${knee} pain after stairs.` });
    await createNote(user.id, { subjective: `Reports ${shoulder} stiffness on waking.` });

    await page.goto('/dashboard/notes');
    const table = page.getByRole('table', { name: 'Your notes' });
    await expect(table.getByText(knee)).toBeVisible();
    await expect(table.getByText(shoulder)).toBeVisible();

    const search = page.getByLabel('Search notes');
    await fill(search, knee);
    await expect(page).toHaveURL(new RegExp(`q=${knee}`));
    await expect(table.getByText(knee)).toBeVisible();
    await expect(table.getByText(shoulder)).toHaveCount(0);

    await fill(search, uniqueWord('nomatch'));
    await expect(page.getByRole('heading', { name: 'No matching notes' })).toBeVisible();
  });

  test('editing a section saves it and records a version', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'notes-edit' });
    const original = `Reports ${uniqueWord('orig')} pain.`;
    const edited = `Reports ${uniqueWord('edit')} pain, improving.`;
    const note = await createNote(user.id, { subjective: original });

    await page.goto(`/dashboard/notes/${note.id}`);
    await expect(page.getByText(original)).toBeVisible();

    await page.getByRole('button', { name: 'Edit Subjective section' }).click();
    await fill(page.getByLabel('Edit Subjective'), edited);
    await page.getByRole('button', { name: 'Save section' }).click();

    await expect(page.getByText(edited)).toBeVisible();
    await expect(page.getByRole('button', { name: 'History (1 edit)' })).toBeVisible();

    // Persisted, not just local state
    await page.reload();
    await expect(page.getByText(edited)).toBeVisible();
    await expect(page.getByText(original)).toHaveCount(0);
  });

  test('archiving a note removes it from the list', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'notes-archive' });
    const marker = uniqueWord('archive');
    const note = await createNote(user.id, { subjective: `Reports ${marker} pain.` });

    await page.goto(`/dashboard/notes/${note.id}`);
    await page.getByRole('button', { name: 'Archive note' }).click();
    await page.getByRole('dialog', { name: 'Archive this note?' }).getByRole('button', { name: 'Archive' }).click();

    await expect(page).toHaveURL('/dashboard/notes');
    await expect(page.getByText(marker)).toHaveCount(0);
  });
});
