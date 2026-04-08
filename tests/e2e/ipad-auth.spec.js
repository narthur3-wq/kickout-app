import { expect, test } from '@playwright/test';

const smokeEmail = process.env.PAIRC_SMOKE_EMAIL?.trim();
const smokePassword = process.env.PAIRC_SMOKE_PASSWORD?.trim();
const hasSmokeConfig = Boolean(
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  smokeEmail &&
  smokePassword
);

test.describe('iPad auth smoke', () => {
  test.skip(
    !hasSmokeConfig,
    'Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, PAIRC_SMOKE_EMAIL, and PAIRC_SMOKE_PASSWORD to run the iPad auth smoke path.'
  );

  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 820, height: 1180 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  });

  test('signs in on an iPad-class WebKit session', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.reload();

    await page.getByLabel('Email').fill(smokeEmail);
    await page.getByLabel('Password').fill(smokePassword);
    await page.getByRole('button', { name: /^Sign in$/i }).click();

    await expect(page.getByRole('button', { name: /^Capture$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('button.match-ctx-bar')).toBeVisible();
  });
});
