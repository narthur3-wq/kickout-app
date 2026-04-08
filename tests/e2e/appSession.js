import { expect } from '@playwright/test';

const smokeEmail = process.env.PAIRC_SMOKE_EMAIL?.trim();
const smokePassword = process.env.PAIRC_SMOKE_PASSWORD?.trim();

export async function signInIfNeeded(page) {
  const signInButton = page.getByRole('button', { name: /^Sign in$/i });
  const captureButton = page.getByRole('button', { name: /^Capture$/i });
  const loginState = await Promise.race([
    captureButton.waitFor({ state: 'visible' }).then(() => 'capture'),
    page.getByPlaceholder('Email').waitFor({ state: 'visible' }).then(() => 'login'),
  ]);

  if (loginState === 'capture') return false;

  if (!smokeEmail || !smokePassword) {
    throw new Error('PAIRC_SMOKE_EMAIL and PAIRC_SMOKE_PASSWORD must be set for signed-in E2E flows.');
  }

  await page.getByLabel('Email').fill(smokeEmail);
  await page.getByLabel('Password').fill(smokePassword);
  await signInButton.click();

  await expect(captureButton).toBeVisible();
  await expect(page.locator('button.match-ctx-bar')).toBeVisible();
  await page.waitForLoadState('networkidle');
  return true;
}

export async function setUpMatch(page, { team = 'Clontarf', opponent = 'Crokes', date = '2026-03-25' } = {}) {
  await page.waitForLoadState('networkidle');

  const matchContextButton = page.locator('button.match-ctx-bar');
  await expect(matchContextButton).toBeVisible({ timeout: 15_000 });
  await matchContextButton.click();

  const dialog = page.getByRole('dialog', { name: 'Match picker' });
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  const newMatchButton = dialog.getByRole('button', { name: /new match/i });
  if (await newMatchButton.count()) {
    await newMatchButton.click();
  }

  await expect(dialog.getByLabel('Team')).toBeVisible({ timeout: 15_000 });
  await dialog.getByLabel('Team').fill(team);
  await dialog.getByLabel('Opponent').fill(opponent);
  await dialog.getByLabel('Date').fill(date);

  await dialog.getByRole('button', { name: /^Create$/i }).click();
  await expect(dialog).toBeHidden();
  await expect(matchContextButton).toContainText(team);
  await expect(matchContextButton).toContainText(opponent);
}

export async function openFreshApp(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await signInIfNeeded(page);
}
