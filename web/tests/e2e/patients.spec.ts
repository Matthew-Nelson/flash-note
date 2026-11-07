import { test, expect } from '@playwright/test';

import { fill, signInNewUser } from './fixtures/web';
import { createNote, createPatient, uniqueWord } from './helpers/db';

/**
 * Patient workflows: create, find, start a note for, and archive a patient.
 */

test.describe('Patients', () => {
  test('creating a patient opens their record and lists them', async ({ page }) => {
    await signInNewUser(page, { label: 'patient-create' });
    const firstName = uniqueWord('Ada');
    const lastName = uniqueWord('Lovelace');

    await page.goto('/dashboard/patients');
    // The empty list repeats the header's Add patient CTA; take the header one
    await page.getByRole('link', { name: 'Add patient' }).first().click();
    await expect(page).toHaveURL('/dashboard/patients/new');

    await fill(page.getByLabel('First name'), firstName);
    await fill(page.getByLabel('Last name'), lastName);
    await fill(page.getByLabel('Patient context'), 'Chronic L knee pain.');
    await page.getByRole('button', { name: 'Save patient' }).click();

    await expect(page).toHaveURL(/\/dashboard\/patients\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('main').getByRole('heading', { name: `${firstName} ${lastName}` })).toBeVisible();
    await expect(page.getByText('Chronic L knee pain.')).toBeVisible();

    await page.goto('/dashboard/patients');
    await expect(page.getByRole('link', { name: `${firstName} ${lastName}` })).toBeVisible();
  });

  test('search narrows the patient list', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'patient-search' });
    const match = uniqueWord('Match');
    const other = uniqueWord('Other');
    await createPatient(user.id, { firstName: 'Pat', lastName: match });
    await createPatient(user.id, { firstName: 'Pat', lastName: other });

    await page.goto('/dashboard/patients');
    const search = page.getByLabel('Search patients');
    await fill(search, match);
    await expect(page).toHaveURL(new RegExp(`q=${match}`));

    await expect(page.getByRole('link', { name: `Pat ${match}` })).toBeVisible();
    await expect(page.getByRole('link', { name: `Pat ${other}` })).toHaveCount(0);
  });

  test('a note started from a patient is generated with that patient selected', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'patient-note' });
    const lastName = uniqueWord('Hopper');
    const patient = await createPatient(user.id, { firstName: 'Grace', lastName });

    await page.goto(`/dashboard/notes/new?patientId=${patient.id}`);
    await expect(page.getByRole('textbox', { name: /^Patient/ })).toHaveValue(`Grace ${lastName}`);

    await fill(page.getByLabel('Session Notes'), 'Pt reports R shoulder pain 3/10');
    await page.getByRole('button', { name: 'Generate Professional Note' }).click();
    await expect(page.getByText('Patient reports pain level of 4/10 at rest')).toBeVisible();
  });

  test("a patient's saved notes are listed on their record and open the note", async ({ page }) => {
    const user = await signInNewUser(page, { label: 'patient-notes' });
    const lastName = uniqueWord('Curie');
    const patient = await createPatient(user.id, { firstName: 'Marie', lastName });
    const note = await createNote(user.id, { subjective: 'Reports neck pain.', patientId: patient.id });

    await page.goto(`/dashboard/patients/${patient.id}`);
    await page.getByRole('table', { name: 'Notes for this patient' }).getByRole('link').click();

    await expect(page).toHaveURL(`/dashboard/notes/${note.id}`);
    await expect(page.getByRole('heading', { name: `Note — Marie ${lastName}` })).toBeVisible();
  });

  test('archiving a patient removes them from the active list', async ({ page }) => {
    const user = await signInNewUser(page, { label: 'patient-archive' });
    const lastName = uniqueWord('Archived');
    const patient = await createPatient(user.id, { firstName: 'Alan', lastName });

    await page.goto(`/dashboard/patients/${patient.id}`);
    await page.getByRole('button', { name: 'Archive patient' }).click();
    await page
      .getByRole('dialog', { name: `Archive Alan ${lastName}?` })
      .getByRole('button', { name: 'Archive patient' })
      .click();

    await expect(page).toHaveURL('/dashboard/patients');
    await expect(page.getByRole('link', { name: `Alan ${lastName}` })).toHaveCount(0);
  });
});
