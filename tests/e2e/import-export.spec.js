import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch, signInIfNeeded } from './appSession.js';

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
  expect(downloadedJson.matches).toEqual(expect.arrayContaining([
    expect.objectContaining({ team: 'Clontarf', opponent: 'Na Fianna', match_date: '2026-03-25' }),
  ]));
  expect(downloadedJson.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ opponent: 'Na Fianna', outcome: 'Retained' }),
  ]));

  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await signInIfNeeded(page);
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
    const authKey = Object.keys(window.localStorage).find((key) => /auth-token/i.test(key));
    let scope = 'local';
    if (authKey) {
      try {
        const authState = JSON.parse(window.localStorage.getItem(authKey) || '{}');
        const userId = authState?.currentSession?.user?.id
          ?? authState?.session?.user?.id
          ?? authState?.user?.id
          ?? null;
        if (userId) scope = `user:${userId}`;
      } catch {}
    }
    const scopedKey = (baseKey) => (scope === 'local' ? baseKey : `${baseKey}:${scope}`);
    const matches = JSON.parse(window.localStorage.getItem(scopedKey('ko_matches')) || '[]');
    const events = JSON.parse(window.localStorage.getItem(scopedKey('ko_events')) || '[]');
    return { matches, events };
  });

  const linkedMatch = storageState.matches.find((match) => match.team === 'Clontarf' && match.opponent === 'Na Fianna');
  const linkedMatchId = linkedMatch?.id;
  expect(linkedMatchId).toBeTruthy();
  expect(storageState.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'remote-event', match_id: linkedMatchId }),
  ]));
});
