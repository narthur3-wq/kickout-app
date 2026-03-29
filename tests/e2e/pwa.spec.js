import { expect, test } from '@playwright/test';

test('the app head links to the generated manifest with credentials', async ({ page }) => {
  await page.goto('/');

  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute('href', /manifest\.webmanifest$/);
  await expect(manifest).toHaveAttribute('crossorigin', 'use-credentials');
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});
