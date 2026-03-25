import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { buildSimulatedMatchState } from '../fixtures/simulatedMatch.js';

test('simulates a match and exports the coach digest as a PNG', async ({ page }) => {
  const simulatedState = buildSimulatedMatchState();

  await page.addInitScript((state) => {
    window.localStorage.clear();
    window.localStorage.setItem('ko_events', JSON.stringify(state.events));
    window.localStorage.setItem('ko_meta', JSON.stringify(state.meta));
    window.localStorage.setItem('ko_sync_queue', JSON.stringify(state.pendingSync));
  }, simulatedState);

  await page.goto('/');

  await expect(page.getByText('Clontarf v Vincents')).toBeVisible();
  await page.getByRole('button', { name: 'Live' }).click();
  await expect(page.getByText('Live Match State')).toBeVisible();
  await expect(page.getByText('Showing all periods in this view.')).toBeVisible();
  await page.getByRole('button', { name: 'H1' }).click();
  await expect(page.getByText(/Phase filter active: showing H1 only/i)).toBeVisible();
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByText('Showing all periods in this view.')).toBeVisible();
  await expect(page.getByText('Primary winner')).toBeVisible();
  await expect(page.getByText('#8 is winning most of their kickouts')).toBeVisible();

  await page.getByRole('button', { name: 'Digest' }).click();
  await expect(page.getByText('Coach Digest')).toBeVisible();
  await expect(page.getByText('Top 3 Actions')).toBeVisible();
  await expect(page.getByText('Press #8 on their kickouts')).toBeVisible();

  const artifactDir = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, 'simulated-match-summary.png');

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Share image' }).click();
  const download = await downloadPromise;
  await download.saveAs(artifactPath);

  const stats = fs.statSync(artifactPath);
  expect(stats.size).toBeGreaterThan(0);
});
