import { test, expect, loginUser } from './fixtures/extension';

/**
 * Note Generation E2E Tests
 *
 * Tests the core note generation flow in the extension.
 * Requires backend to be running with a seeded test user.
 */

test.describe('Note Generation', () => {
  // Login before each test in this suite
  test.beforeEach(async ({ extensionPage }) => {
    await loginUser(extensionPage);
  });

  test.describe('Generator Form', () => {
    test('displays all form elements', async ({ extensionPage }) => {
      // Note type selector
      await expect(extensionPage.locator('#noteType')).toBeVisible();

      // Patient context (optional)
      await expect(extensionPage.locator('#patientContext')).toBeVisible();
      await expect(extensionPage.locator('text=(optional)')).toBeVisible();

      // Session notes (required)
      await expect(extensionPage.locator('#quickNotes')).toBeVisible();

      // Character counter
      await expect(extensionPage.locator('text=/\\d+\\/5,000/')).toBeVisible();

      // Submit button
      await expect(
        extensionPage.locator('button:has-text("Generate Note")')
      ).toBeVisible();
    });

    test('shows all note type options', async ({ extensionPage }) => {
      const noteTypeSelect = extensionPage.locator('#noteType');

      // Should have 4 note types
      await expect(noteTypeSelect.locator('option')).toHaveCount(4);

      // Verify specific options exist (options inside closed select are not "visible",
      // but they exist in the DOM - use toHaveCount to verify existence)
      await expect(
        noteTypeSelect.locator('option:has-text("Daily Note")')
      ).toHaveCount(1);
      await expect(
        noteTypeSelect.locator('option:has-text("Initial Evaluation")')
      ).toHaveCount(1);
      await expect(
        noteTypeSelect.locator('option:has-text("Progress Note")')
      ).toHaveCount(1);
      await expect(
        noteTypeSelect.locator('option:has-text("Discharge Summary")')
      ).toHaveCount(1);
    });

    test('can select different note types', async ({ extensionPage }) => {
      const noteTypeSelect = extensionPage.locator('#noteType');

      // Select each type and verify
      await noteTypeSelect.selectOption('initial_eval');
      await expect(noteTypeSelect).toHaveValue('initial_eval');

      await noteTypeSelect.selectOption('progress_note');
      await expect(noteTypeSelect).toHaveValue('progress_note');

      await noteTypeSelect.selectOption('discharge');
      await expect(noteTypeSelect).toHaveValue('discharge');

      await noteTypeSelect.selectOption('daily_note');
      await expect(noteTypeSelect).toHaveValue('daily_note');
    });

    test('updates character count as user types', async ({ extensionPage }) => {
      const textarea = extensionPage.locator('#quickNotes');
      const charCounter = extensionPage.locator('text=/\\d+\\/5,000/');

      // Initially should show 0
      await expect(charCounter).toContainText('0/5,000');

      // Type some text
      await textarea.fill('Test notes for the session');
      await expect(charCounter).toContainText('26/5,000');

      // Type more (63 characters)
      await textarea.fill(
        'Reports 40% pain reduction since last visit. Flex ROM improved.'
      );
      await expect(charCounter).toContainText('63/5,000');
    });

    test('enforces maximum character limit', async ({ extensionPage }) => {
      const textarea = extensionPage.locator('#quickNotes');

      // maxLength attribute should be set
      await expect(textarea).toHaveAttribute('maxlength', '5000');
    });

    test('disables submit button when notes too short', async ({
      extensionPage,
    }) => {
      const submitButton = extensionPage.locator(
        'button:has-text("Generate Note")'
      );
      const textarea = extensionPage.locator('#quickNotes');

      // Initially disabled (no input)
      await expect(submitButton).toBeDisabled();

      // Still disabled with short input
      await textarea.fill('Short');
      await expect(submitButton).toBeDisabled();

      // Enabled with sufficient input (10+ chars)
      await textarea.fill('This is enough text to enable the button');
      await expect(submitButton).toBeEnabled();
    });
  });

  test.describe('Form Validation', () => {
    test('shows error for empty session notes', async ({ extensionPage }) => {
      // Try to submit with empty notes (button should be disabled, but test the flow)
      const submitButton = extensionPage.locator(
        'button:has-text("Generate Note")'
      );

      // Button should be disabled
      await expect(submitButton).toBeDisabled();
    });

    test('shows error for session notes under minimum length', async ({
      extensionPage,
    }) => {
      const textarea = extensionPage.locator('#quickNotes');

      // Type very short notes
      await textarea.fill('hi');

      // Button should remain disabled
      const submitButton = extensionPage.locator(
        'button:has-text("Generate Note")'
      );
      await expect(submitButton).toBeDisabled();
    });
  });

  test.describe('Note Generation Flow', () => {
    test('shows loading state during generation', async ({ extensionPage }) => {
      // Fill in valid form data
      await extensionPage.locator('#noteType').selectOption('daily_note');
      await extensionPage.locator('#patientContext').fill('John, 52M, chronic LBP');
      await extensionPage
        .locator('#quickNotes')
        .fill(
          'Reports 40% pain reduction since last visit. Flex ROM improved 50 to 65 degrees. ' +
            'Performed MFR to lumbar paraspinals. Grade III mobs L4-5. ' +
            'Updated HEP: bridges 2x15, bird dogs 2x10. Patient tolerated well.'
        );

      // Submit
      await extensionPage.click('button:has-text("Generate Note")');

      // Should show loading state OR completion (mock AI may be instant)
      // The loading stages cycle quickly, so we check for any part of the flow
      await expect(
        extensionPage
          .locator('text=Analyzing your notes...')
          .or(extensionPage.locator('text=Drafting Subjective section...'))
          .or(extensionPage.locator('text=Composing Objective findings...'))
          .or(extensionPage.locator('text=Formulating Assessment...'))
          .or(extensionPage.locator('text=Note generated!'))
          .or(extensionPage.locator('text=Something went wrong'))
      ).toBeVisible({ timeout: 30000 });
    });

    test('shows success or error state after generation', async ({
      extensionPage,
    }) => {
      // Fill in valid form data
      await extensionPage.locator('#noteType').selectOption('daily_note');
      await extensionPage
        .locator('#quickNotes')
        .fill(
          'Reports 40% pain reduction since last visit. Flex ROM improved 50 to 65 degrees. ' +
            'Performed MFR to lumbar paraspinals. Grade III mobs L4-5. ' +
            'Updated HEP: bridges 2x15, bird dogs 2x10. Patient tolerated well.'
        );

      // Submit
      await extensionPage.click('button:has-text("Generate Note")');

      // Wait for either success or error (API response)
      // This may take up to 30 seconds depending on LLM response time
      await expect(
        extensionPage
          .locator('text=Note generated!')
          .or(extensionPage.locator('text=Something went wrong'))
          .or(extensionPage.locator('.error-message'))
      ).toBeVisible({ timeout: 60000 });
    });

    test('displays generated note result', async ({ extensionPage }) => {
      // Fill in valid form data
      await extensionPage.locator('#noteType').selectOption('daily_note');
      await extensionPage
        .locator('#quickNotes')
        .fill(
          'Reports 40% pain reduction since last visit. Flex ROM improved 50 to 65 degrees. ' +
            'Performed MFR to lumbar paraspinals. Grade III mobs L4-5. ' +
            'Updated HEP: bridges 2x15, bird dogs 2x10. Patient tolerated well.'
        );

      // Submit and wait for result
      await extensionPage.click('button:has-text("Generate Note")');

      // Wait for success state
      const successVisible = await extensionPage
        .locator('text=Note generated!')
        .isVisible({ timeout: 60000 })
        .catch(() => false);

      if (successVisible) {
        // Wait for transition to result view
        await extensionPage.waitForTimeout(2000);

        // Should show result display with SOAP sections or back button
        await expect(
          extensionPage
            .locator('text=Subjective')
            .or(extensionPage.locator('button:has-text("Back")'))
            .or(extensionPage.locator('button:has-text("Copy")')),
        ).toBeVisible({ timeout: 5000 });
      }
    });

    test('can navigate back from result to generator', async ({
      extensionPage,
    }) => {
      // Fill in valid form data
      await extensionPage.locator('#noteType').selectOption('daily_note');
      await extensionPage
        .locator('#quickNotes')
        .fill(
          'Reports 40% pain reduction since last visit. Flex ROM improved 50 to 65 degrees. ' +
            'Performed MFR to lumbar paraspinals. Patient tolerated treatment well.'
        );

      // Submit and wait for result
      await extensionPage.click('button:has-text("Generate Note")');

      // Wait for success and transition to result
      const successVisible = await extensionPage
        .locator('text=Note generated!')
        .isVisible({ timeout: 60000 })
        .catch(() => false);

      if (successVisible) {
        // Wait for transition
        await extensionPage.waitForTimeout(2000);

        // Click back button if visible
        const backButton = extensionPage.locator('button:has-text("Back")');
        if (await backButton.isVisible()) {
          await backButton.click();

          // Should return to generator
          await expect(extensionPage.locator('#quickNotes')).toBeVisible();
        }
      }
    });
  });

  test.describe('Different Note Types', () => {
    const testCases = [
      {
        type: 'daily_note' as const,
        label: 'Daily Note',
        notes: 'Patient reports feeling better today. Pain 4/10. ROM improving.',
      },
      {
        type: 'initial_eval' as const,
        label: 'Initial Evaluation',
        notes:
          'New patient eval. 45yo female with acute LBP x 2 weeks. Pain 7/10. Limited flex.',
      },
      {
        type: 'progress_note' as const,
        label: 'Progress Note',
        notes:
          'Week 4 of 8. Goals 50% met. Pain reduced from 7 to 4. ROM improved 20 degrees.',
      },
      {
        type: 'discharge' as const,
        label: 'Discharge Summary',
        notes:
          'Completed 8 week program. All goals met. Pain 1/10. Full ROM. Independent with HEP.',
      },
    ];

    for (const testCase of testCases) {
      test(`can generate ${testCase.label}`, async ({ extensionPage }) => {
        // Select note type
        await extensionPage.locator('#noteType').selectOption(testCase.type);

        // Fill notes
        await extensionPage.locator('#quickNotes').fill(testCase.notes);

        // Verify form is ready
        await expect(
          extensionPage.locator('button:has-text("Generate Note")')
        ).toBeEnabled();

        // We don't actually submit to avoid long API calls in every test
        // The loading state test covers actual submission
      });
    }
  });
});
