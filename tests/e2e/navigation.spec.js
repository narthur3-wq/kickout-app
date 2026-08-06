import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch } from './appSession.js';

async function openInGameSection(tabBar, input = 'click') {
  const action = input === 'tap' ? 'tap' : 'click';
  await tabBar.getByRole('tab', { name: /^In-game$/i })[action]();
}

test('moving between tabs keeps Kickouts reachable from every main screen', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

  const tabBar = page.locator('nav.tab-bar');

  await openInGameSection(tabBar);
  await tabBar.getByRole('tab', { name: /^Live/i }).click();
  await expect(page.getByText('Live Match State')).toBeVisible();

  await tabBar.getByRole('tab', { name: /^Kickouts/i }).click();
  await expect(page.getByText(/Showing all periods in this view/i)).toBeVisible();
  await expect(tabBar.getByRole('tab', { name: /^Kickouts/i })).toHaveClass(/active/);

  await tabBar.getByRole('tab', { name: /^Shots/i }).click();
  await expect(page.locator('.panel-title')).toHaveText('Shots');

  await tabBar.getByRole('tab', { name: /^Turnovers/i }).click();
  await expect(page.locator('.panel-title')).toHaveText('Turnovers');

  await tabBar.getByRole('tab', { name: /^Events/i }).click();
  await expect(page.getByText('These filters only change the Events table.')).toBeVisible();

  await tabBar.getByRole('tab', { name: /^Digest/i }).click();
  await expect(page.getByText(/No events yet for this digest/i)).toBeVisible();

  await tabBar.getByRole('tab', { name: /^Capture/i }).click();
  await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();

  await openInGameSection(tabBar);
  await tabBar.getByRole('tab', { name: /^Kickouts/i }).click();
  await expect(page.getByText(/Showing all periods in this view/i)).toBeVisible();
  await expect(tabBar.getByRole('tab', { name: /^Kickouts/i })).toHaveClass(/active/);
});

test.describe('touch tab movement', () => {
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 1180, height: 820 } });

  test('touch users can move capture to kickouts to shots to turnovers and back again', async ({ page }) => {
    await openFreshApp(page);
    await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

    const tabBar = page.locator('nav.tab-bar');

    await openInGameSection(tabBar, 'tap');
    await tabBar.getByRole('tab', { name: /^Kickouts/i }).tap();
    await expect(tabBar.getByRole('tab', { name: /^Kickouts/i })).toHaveClass(/active/);

    await tabBar.getByRole('tab', { name: /^Shots/i }).tap();
    await expect(tabBar.getByRole('tab', { name: /^Shots/i })).toHaveClass(/active/);

    await tabBar.getByRole('tab', { name: /^Turnovers/i }).tap();
    await expect(tabBar.getByRole('tab', { name: /^Turnovers/i })).toHaveClass(/active/);

    await tabBar.getByRole('tab', { name: /^Kickouts/i }).tap();
    await expect(tabBar.getByRole('tab', { name: /^Kickouts/i })).toHaveClass(/active/);

    await tabBar.getByRole('tab', { name: /^Capture/i }).tap();
    await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();
  });
});
