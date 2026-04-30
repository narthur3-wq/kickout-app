import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch } from './appSession.js';

test('core match-day controls expose keyboard and accessible names', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'A11y Rovers' });

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Clontarf vs A11y Rovers/i })).toBeFocused();

  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Capture$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Live$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Digest$/i })).toBeVisible();

  const pitch = page.getByRole('application', { name: /GAA pitch/i });
  await pitch.focus();
  await expect(pitch).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();
});
