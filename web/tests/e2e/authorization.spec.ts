import { test, expect } from '@playwright/test';

import { fill, loginViaUI, signInNewUser } from './fixtures/web';
import { createNote, createPatient, createUser, uniqueWord, type TestUser } from './helpers/db';

/**
 * Cross-account authorization (Rules 5, 6, 8): one therapist must not be able
 * to read or use another therapist's patients or notes, whether by URL,
 * list, search, or a forged patientId on note generation.
 */

test.describe('Cross-account access', () => {
  let owner: TestUser;
  let ownerPatient: { id: string; name: string };
  let ownerNote: { id: string; marker: string };

  test.beforeEach(async () => {
    owner = await createUser({ label: 'owner' });
    const lastName = uniqueWord('Private');
    const patient = await createPatient(owner.id, { firstName: 'Owned', lastName });
    const marker = uniqueWord('secret');
    const note = await createNote(owner.id, { subjective: `Reports ${marker} pain.`, patientId: patient.id });
    ownerPatient = { id: patient.id, name: `Owned ${lastName}` };
    ownerNote = { id: note.id, marker };
  });

  // These render the not-found page but with HTTP 200, not 404: the dashboard's
  // loading.tsx boundaries stream the page shell before notFound() runs.
  test("another account gets not-found for the owner's note URL", async ({ page }) => {
    await signInNewUser(page, { label: 'intruder' });

    await page.goto(`/dashboard/notes/${ownerNote.id}`);

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByText(ownerNote.marker)).toHaveCount(0);
  });

  test("another account gets not-found for the owner's patient URL", async ({ page }) => {
    await signInNewUser(page, { label: 'intruder' });

    await page.goto(`/dashboard/patients/${ownerPatient.id}`);

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByText(ownerPatient.name)).toHaveCount(0);
  });

  test("the owner's records never appear in another account's lists or search", async ({ page }) => {
    await signInNewUser(page, { label: 'intruder' });

    await page.goto(`/dashboard/notes?q=${ownerNote.marker}`);
    await expect(page.getByRole('heading', { name: 'No matching notes' })).toBeVisible();

    await page.goto('/dashboard/notes');
    await expect(page.getByRole('heading', { name: 'No notes yet' })).toBeVisible();

    await page.goto('/dashboard/patients');
    await expect(page.getByText(ownerPatient.name)).toHaveCount(0);
  });

  test("another account cannot generate a note against the owner's patient", async ({ page }) => {
    await signInNewUser(page, { label: 'intruder' });

    await page.goto(`/dashboard/notes/new?patientId=${ownerPatient.id}`);
    // The page loads the patient through the DAL with the intruder's scope, so nothing is shown
    await expect(page.getByRole('textbox', { name: /^Patient/ })).toHaveValue('');

    // The page also drops the id, so the generation request never carries it
    // and the note isn't tied to the owner's patient. Server-side refusal of a
    // foreign patientId is covered in actions/notes.test.ts (generate and save).
    await fill(page.getByLabel('Session Notes'), 'Pt reports knee pain');
    const generateRequest = page.waitForRequest(
      (req) => req.method() === 'POST' && new URL(req.url()).pathname === '/dashboard/notes/new',
    );
    await page.getByRole('button', { name: 'Generate Professional Note' }).click();
    expect((await generateRequest).postData() ?? '').not.toContain(ownerPatient.id);
    await expect(page.getByText('Patient reports pain level of 4/10 at rest')).toBeVisible();
  });

  test('the owner can open the same note and patient', async ({ page }) => {
    // Control case: proves the not-found pages above come from scoping, not broken pages
    await loginViaUI(page, owner);

    await page.goto(`/dashboard/notes/${ownerNote.id}`);
    await expect(page.getByText(ownerNote.marker)).toBeVisible();
    await page.goto(`/dashboard/patients/${ownerPatient.id}`);
    await expect(page.getByRole('main').getByRole('heading', { name: ownerPatient.name })).toBeVisible();
  });
});
