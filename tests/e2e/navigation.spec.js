import { expect, test } from '@playwright/test';

async function openFreshApp(page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function setUpMatch(page, { team = 'Clontarf', opponent = 'Crokes', date = '2026-03-25' } = {}) {
  await page.getByRole('button', { name: /Tap to (set up|create)/i }).click();
  await page.getByLabel('Team').fill(team);
  await page.getByLabel('Opponent').fill(opponent);
  await page.getByLabel('Date').fill(date);
  await page.getByRole('dialog', { name: 'Match picker' }).getByRole('button', { name: 'Create', exact: true }).click();
}

test('moving between tabs keeps Kickouts reachable from every main screen', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

  const tabBar = page.locator('nav.tab-bar');

  await tabBar.getByRole('button', { name: /^Live/i }).click();
  await expect(page.getByText('Live Match State')).toBeVisible();

  await tabBar.getByRole('button', { name: /^Kickouts/i }).click();
  await expect(page.getByText(/Showing all periods in this view/i)).toBeVisible();
  await expect(tabBar.getByRole('button', { name: /^Kickouts/i })).toHaveClass(/active/);

  await tabBar.getByRole('button', { name: /^Shots/i }).click();
  await expect(page.locator('.panel-title')).toHaveText('Shots');

  await tabBar.getByRole('button', { name: /^Turnovers/i }).click();
  await expect(page.locator('.panel-title')).toHaveText('Turnovers');

  await tabBar.getByRole('button', { name: /^Events/i }).click();
  await expect(page.getByText('These filters only change the Events table.')).toBeVisible();

  await tabBar.getByRole('button', { name: /^Digest/i }).click();
  await expect(page.getByText(/No events yet for this digest/i)).toBeVisible();

  await tabBar.getByRole('button', { name: /^Capture/i }).click();
  await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();

  await tabBar.getByRole('button', { name: /^Kickouts/i }).click();
  await expect(page.getByText(/Showing all periods in this view/i)).toBeVisible();
  await expect(tabBar.getByRole('button', { name: /^Kickouts/i })).toHaveClass(/active/);
});

test.describe('touch tab movement', () => {
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 1180, height: 820 } });

  test('touch users can move capture to kickouts to shots to turnovers and back again', async ({ page }) => {
    await openFreshApp(page);
    await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

    const tabBar = page.locator('nav.tab-bar');

    await tabBar.getByRole('button', { name: /^Kickouts/i }).tap();
    await expect(tabBar.getByRole('button', { name: /^Kickouts/i })).toHaveClass(/active/);

    await tabBar.getByRole('button', { name: /^Shots/i }).tap();
    await expect(tabBar.getByRole('button', { name: /^Shots/i })).toHaveClass(/active/);

    await tabBar.getByRole('button', { name: /^Turnovers/i }).tap();
    await expect(tabBar.getByRole('button', { name: /^Turnovers/i })).toHaveClass(/active/);

    await tabBar.getByRole('button', { name: /^Kickouts/i }).tap();
    await expect(tabBar.getByRole('button', { name: /^Kickouts/i })).toHaveClass(/active/);

    await tabBar.getByRole('button', { name: /^Capture/i }).tap();
    await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();
  });
});
