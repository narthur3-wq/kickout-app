import { readFile } from 'node:fs/promises';
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

  expect(downloadedJson).toEqual(expect.objectContaining({
    matches: expect.any(Array),
    events: expect.any(Array),
  }));
  expect(downloadedJson.matches).toHaveLength(1);
  expect(downloadedJson.events).toHaveLength(1);
  expect(downloadedJson.events[0]).toEqual(expect.objectContaining({ opponent: 'Na Fianna', outcome: 'Retained' }));

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
  await expect(page.getByRole('cell', { name: 'Clontarf' })).toBeVisible();
});

test('JSON import reuses an existing logical match when the imported id differs', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Na Fianna' });

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /^Events/i }).click();
  await page.getByRole('button', { name: /Import JSON/i }).click();
  const chooser = await chooserPromise;

  await chooser.setFiles({
    name: 'pairc_events.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      matches: [
        {
          id: 'remote-match',
          team: 'Clontarf',
          opponent: 'Na Fianna',
          match_date: '2026-03-25',
          status: 'open',
        },
      ],
      events: [
        {
          id: 'remote-event',
          match_id: 'remote-match',
          created_at: '2026-03-25T12:00:00.000Z',
          match_date: '2026-03-25',
          team: 'Clontarf',
          opponent: 'Na Fianna',
          period: 'H1',
          clock: '03:00',
          outcome: 'Retained',
          contest_type: 'clean',
          event_type: 'kickout',
          direction: 'ours',
          x: 0.4,
          y: 0.3,
          schema_version: 1,
        },
      ],
    }, null, 2)),
  });

  await expect(page.getByText(/Imported 1 new event\(s\)/i)).toBeVisible();
  await expect(page.getByText(/Linked 1 imported match record\(s\) to existing matches/i)).toBeVisible();

  const storageState = await page.evaluate(() => {
    const matches = JSON.parse(window.localStorage.getItem('ko_matches') || '[]');
    const events = JSON.parse(window.localStorage.getItem('ko_events') || '[]');
    return { matches, events };
  });

  expect(storageState.matches).toHaveLength(1);
  expect(storageState.events).toHaveLength(1);
  expect(storageState.events[0].match_id).toBe(storageState.matches[0].id);
});
