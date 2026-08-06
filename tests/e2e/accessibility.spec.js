import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch } from './appSession.js';

test('core match-day controls expose keyboard and accessible names', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'A11y Rovers' });

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: /Clontarf vs A11y Rovers/i })).toBeFocused();

  await expect(page.getByRole('navigation')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Capture$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^In-game$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Tools$/i })).toBeVisible();

  await page.getByRole('tab', { name: /^In-game$/i }).click();
  await expect(page.getByRole('tab', { name: /^Live$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Digest$/i })).toBeVisible();

  await page.getByRole('tab', { name: /^Capture$/i }).click();
  const pitch = page.getByRole('application', { name: /GAA pitch/i });
  await pitch.focus();
  await expect(pitch).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();
});

test('exposes a main landmark and a heading outline', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'A11y Rovers' });

  // The app used to expose header and nav but no main, so there was no way to
  // skip past the chrome to the content.
  await expect(page.getByRole('main')).toBeVisible();

  await page.getByRole('tab', { name: /^In-game$/i }).click();
  await page.getByRole('tab', { name: /^Live$/i }).click();

  // And exactly one heading in the whole document — the wordmark — so no
  // outline to navigate by. Panel titles are real headings now.
  const headings = await page.getByRole('heading').allTextContents();
  expect(headings.length).toBeGreaterThan(3);
  expect(headings.some((h) => /Live Match State/i.test(h))).toBe(true);
});

test('tabs report their selected state and move with arrow keys', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'A11y Rovers' });

  const tabBar = page.locator('nav.tab-bar');
  await expect(tabBar.getByRole('tab', { name: /^Capture$/i })).toHaveAttribute('aria-selected', 'true');
  await expect(tabBar.getByRole('tab', { name: /^In-game$/i })).toHaveAttribute('aria-selected', 'false');

  // Announcing these as tabs promises arrow-key movement. Without it the role
  // is a lie, which is worse than leaving them as plain buttons.
  await tabBar.getByRole('tab', { name: /^Capture$/i }).focus();
  await page.keyboard.press('ArrowRight');

  await expect(tabBar.getByRole('tab', { name: /^In-game$/i })).toHaveAttribute('aria-selected', 'true');
  await expect(tabBar.getByRole('tab', { name: /^Capture$/i })).toHaveAttribute('aria-selected', 'false');

  await page.keyboard.press('ArrowLeft');
  await expect(tabBar.getByRole('tab', { name: /^Capture$/i })).toHaveAttribute('aria-selected', 'true');
});

test('every interactive control shows a focus ring when reached by keyboard', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'A11y Rovers' });

  // `:focus-visible` was defined in two components out of fifteen, and nine
  // `outline: none` rules suppressed the rest.
  const missing = await page.evaluate(() => {
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try { return [...sheet.cssRules].map((r) => r.cssText || ''); } catch { return []; }
    });
    return {
      hasGlobalRule: rules.some((t) => t.includes(':focus-visible') && t.includes('outline')),
      suppressions: rules.filter((t) => /outline:\s*(none|0)/.test(t)).length,
    };
  });

  expect(missing.hasGlobalRule).toBe(true);
  expect(missing.suppressions).toBe(0);
});
