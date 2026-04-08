import { expect, test } from '@playwright/test';

const smokeEmail = process.env.PAIRC_SMOKE_EMAIL?.trim();
const smokePassword = process.env.PAIRC_SMOKE_PASSWORD?.trim();
const offlineMode = process.env.VITE_E2E_OFFLINE_MODE === 'true';
const placeholderSmokeCreds =
  smokeEmail === 'smoke@yourapp.com' ||
  smokePassword === 'Newpass';
const hasSmokeConfig = Boolean(
  !offlineMode &&
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  smokeEmail &&
  smokePassword &&
  !placeholderSmokeCreds
);

test.describe('Supabase smoke', () => {
  test.skip(
    !hasSmokeConfig,
    'Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, PAIRC_SMOKE_EMAIL, and PAIRC_SMOKE_PASSWORD to run the Supabase smoke path.'
  );

  test('can sign in, create a match, save an event, and survive a reload', async ({ page }) => {
    const team = process.env.PAIRC_SMOKE_TEAM?.trim() || 'Smoke Team';
    const opponent = process.env.PAIRC_SMOKE_OPPONENT?.trim() || 'Smoke Opponent';
    const matchDate = process.env.PAIRC_SMOKE_DATE?.trim() || new Date().toISOString().slice(0, 10);

    await page.goto('/');
    await page.getByPlaceholder('Email').fill(smokeEmail);
    await page.getByPlaceholder('Password').fill(smokePassword);
    await page.getByRole('button', { name: /Sign in/i }).click();

    await expect(page.getByRole('button', { name: /Capture/i })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.locator('button.match-ctx-bar').click();
    if (await page.getByRole('button', { name: /^\+ New match$/ }).count()) {
      await page.getByRole('button', { name: /^\+ New match$/ }).click();
    }

    await page.getByLabel('Team').fill(team);
    await page.getByLabel('Opponent').fill(opponent);
    await page.getByLabel('Date').fill(matchDate);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    await page.locator('svg[aria-label*="GAA pitch"]').click({ position: { x: 220, y: 120 } });
    await page.getByRole('button', { name: /Save Event/i }).click();

    await page.getByRole('button', { name: /^Events/i }).click();
    await expect(page.getByRole('cell', { name: opponent })).toBeVisible();
    await expect(page.locator('.outcome-badge').first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('button', { name: /Capture/i })).toBeVisible();
    await page.getByRole('button', { name: /^Events/i }).click();
    await expect(page.getByRole('cell', { name: opponent })).toBeVisible();
  });
});
