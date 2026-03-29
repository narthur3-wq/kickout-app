import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

async function openFreshApp(page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
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

test('JSON export can round-trip back into the app', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Na Fianna' });

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.getByRole('button', { name: /^Events/i }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export JSON/i }).click();
  const download = await downloadPromise;
  const downloadedPath = await download.path();
  const downloadedJson = JSON.parse(await readFile(downloadedPath, 'utf8'));

  expect(downloadedJson).toHaveLength(1);
  expect(downloadedJson[0]).toEqual(expect.objectContaining({ opponent: 'Na Fianna', outcome: 'Retained' }));

  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: /^Events/i }).click();
  await expect(page.getByText(/No events recorded yet/i)).toBeVisible();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import JSON/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'pairc_events.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(downloadedJson, null, 2)),
  });

  await expect(page.getByText(/Imported 1 new event\(s\)/i)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Na Fianna' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Retained' })).toBeVisible();
});
