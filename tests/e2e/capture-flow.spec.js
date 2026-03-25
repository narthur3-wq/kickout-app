import { expect, test } from '@playwright/test';

async function openFreshApp(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
}

async function setUpMatch(page, { team = 'Clontarf', opponent = 'Crokes', date = '2026-03-25' } = {}) {
  await page.getByRole('button', { name: /Tap to set up match/i }).click();
  await page.getByLabel('Team').fill(team);
  await page.getByLabel('Opponent').fill(opponent);
  await page.getByLabel('Date').fill(date);
  await page.getByRole('button', { name: 'Done' }).click();
}

async function placeLandingPoint(page, position = { x: 220, y: 120 }) {
  await page.locator('svg[aria-label*="GAA pitch"]').click({ position });
}

test('captures a live event and restores the match after reload', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page);

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.getByRole('button', { name: /Events/i }).click();
  await expect(page.getByRole('cell', { name: 'Crokes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Retained' })).toBeVisible();

  await page.reload();

  await expect(page.locator('button.match-ctx-bar')).toContainText('Clontarf vs Crokes');
  await page.getByRole('button', { name: /Events/i }).click();
  await expect(page.getByRole('cell', { name: 'Crokes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Retained' })).toBeVisible();
});

test('returns to live capture cleanly after editing and cancelling an event', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Vincents' });

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.getByRole('button', { name: /Events/i }).click();
  await page.getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByText(/Editing event/i)).toBeVisible();
  await page.getByRole('button', { name: /Cancel/i }).click();

  await expect(page.getByText(/Editing event/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Clontarf vs Vincents/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();
});
