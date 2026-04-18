import { test, expect, type Page } from '@playwright/test';

const ADMIN_USER = process.env.CLEF_BASE_ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.CLEF_BASE_ADMIN_PASSWORD || 'change-me-now';

// Helper: navigate past the auth wall using the Clef Base admin login form
async function loginAsAdmin(page: Page) {
  await page.goto('/admin');
  // Fill the admin login form (username + password)
  await page.locator('[name="user"]').fill(ADMIN_USER);
  await page.locator('[name="password"]').fill(ADMIN_PASS);
  await page.getByRole('button', { name: /open admin/i }).click();
  await page.waitForURL('**/admin**', { timeout: 10000 });
}

test.describe('Governance setup flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('governance page loads with three tabs', async ({ page }) => {
    await page.goto('/admin/governance');
    await expect(page.getByRole('button', { name: /structure/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /routes/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /permissions/i })).toBeVisible();
  });

  test('create a team', async ({ page }) => {
    await page.goto('/admin/governance');
    const teamName = `E2E Team ${Date.now()}`;

    // Click "+" in the teams sidebar
    await page.getByRole('button', { name: '+' }).first().click();

    // Fill in team name
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: /create/i }).click();

    // The team should appear in the sidebar as a button (not in the TreeDisplay span)
    await expect(page.locator('button', { hasText: teamName }).first()).toBeVisible({ timeout: 5000 });
  });

  test('add a member to a team', async ({ page }) => {
    await page.goto('/admin/governance');
    const teamName = `E2E Team ${Date.now()}`;

    // Create team
    await page.getByRole('button', { name: '+' }).first().click();
    await page.getByLabel(/team name/i).fill(teamName);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.locator('button', { hasText: teamName }).first()).toBeVisible({ timeout: 5000 });

    // Click on the team (sidebar button — not the TreeDisplay node label span)
    await page.locator('button', { hasText: teamName }).first().click();
    await expect(page.getByText(/no members yet/i)).toBeVisible();

    // Add a member
    await page.getByRole('button', { name: /add member/i }).click();
    await page.getByPlaceholder(/user@example/i).fill('alice@example.com');
    await page.getByRole('button', { name: /^add$/i }).click();

    // Member should appear in the members list (li element, not the status notification)
    await expect(page.locator('li', { hasText: 'alice@example.com' })).toBeVisible({ timeout: 5000 });
  });

  test('create a process spec and add steps in FlowBuilder', async ({ page }) => {
    await page.goto('/admin/governance');

    // Switch to Routes tab
    await page.getByRole('button', { name: /routes/i }).click();

    const specName = `E2E Spec ${Date.now()}`;

    // Create spec
    await page.getByRole('button', { name: '+' }).first().click();
    await page.getByLabel(/spec name/i).fill(specName);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText(specName)).toBeVisible({ timeout: 5000 });

    // Click on the spec (only the sidebar button has specName before it's selected)
    await page.getByText(specName).click();

    // FlowBuilder should show
    await expect(page.getByRole('application', { name: /flow builder/i })).toBeVisible({ timeout: 5000 });

    // Click "Add first step" — button text matches but aria-label is "Insert step at position 0",
    // so target by visible text rather than accessible name
    await page.locator('button', { hasText: /add first step/i }).click();

    // A step row should appear (data-step-kind attribute set on step items)
    await expect(page.locator('[data-step-kind]').first()).toBeVisible({ timeout: 5000 });
  });

  test('start a process run and view status', async ({ page }) => {
    await page.goto('/admin/governance');

    // Switch to Routes tab
    await page.getByRole('button', { name: /routes/i }).click();

    const specName = `E2E Run Spec ${Date.now()}`;

    // Create spec
    await page.getByRole('button', { name: '+' }).first().click();
    await page.getByLabel(/spec name/i).fill(specName);
    await page.getByRole('button', { name: /create/i }).click();
    await expect(page.getByText(specName)).toBeVisible({ timeout: 5000 });

    // Select spec (sidebar button is the only element with specName before selection)
    await page.getByText(specName).click();
    await expect(page.getByRole('application', { name: /flow builder/i })).toBeVisible({ timeout: 5000 });

    // Click "▶ Run Process"
    await page.getByRole('button', { name: /run process/i }).click();
    await expect(page.getByRole('dialog', { name: /start process run/i })).toBeVisible({ timeout: 3000 });

    // Click Start
    await page.getByRole('button', { name: /start/i }).click();

    // Should navigate to process run view
    await page.waitForURL('**/process-runs/**', { timeout: 10000 });

    // Run status badge should show "running" (variant="info")
    // Using data-part + data-variant to avoid matching "Process running" EmptyState title
    await expect(page.locator('[data-part="badge"][data-variant="info"]').first()).toBeVisible({ timeout: 5000 });

    // Click "Mark Complete"
    await page.getByRole('button', { name: /mark complete/i }).click();

    // Status badge should change to "completed" (variant="success")
    await expect(page.locator('[data-part="badge"][data-variant="success"]').first()).toBeVisible({ timeout: 5000 });
  });
});
