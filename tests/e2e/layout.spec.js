import { expect, test } from '@playwright/test';

function storedEvent(id, overrides = {}) {
  return {
    id,
    created_at: '2026-03-25T12:00:00.000Z',
    match_date: '2026-03-25',
    team: 'Clontarf',
    opponent: 'Kilmacud Crokes',
    period: 'H1',
    clock: '05:00',
    event_type: 'kickout',
    direction: 'ours',
    outcome: 'Retained',
    contest_type: 'clean',
    target_player: '8',
    restart_reason: 'Score',
    x: 0.48,
    y: 0.24,
    schema_version: 1,
    ko_sequence: 1,
    ...overrides,
  };
}

async function openFreshApp(page) {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function setUpMatch(page, { team = 'Clontarf', opponent = 'Crokes', date = '2026-03-25' } = {}) {
  await page.getByRole('button', { name: /Tap to set up match/i }).click();
  await page.getByRole('button', { name: /\+ New match/i }).click();
  await page.getByLabel('Team').fill(team);
  await page.getByLabel('Opponent').fill(opponent);
  await page.getByLabel('Date').fill(date);
  await page.getByRole('button', { name: 'Create' }).click();
}

test.use({ viewport: { width: 1366, height: 768 } });

test('landscape capture keeps the save controls reachable', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

  const saveButton = page.getByRole('button', { name: /Save Event/i });
  await expect(saveButton).toBeVisible();

  const box = await saveButton.boundingBox();
  expect(box).not.toBeNull();
  expect(box.y + box.height).toBeLessThanOrEqual(768);
});

test('analytics pitch stays fully in view in landscape on Kickouts, Shots, and Turnovers', async ({ page }) => {
  await page.addInitScript(({ events, meta }) => {
    window.localStorage.clear();
    window.localStorage.setItem('ko_events', JSON.stringify(events));
    window.localStorage.setItem('ko_meta', JSON.stringify(meta));
    window.localStorage.setItem('ko_sync_queue', JSON.stringify([]));
  }, {
    events: [
      storedEvent('kickout-1', { event_type: 'kickout', outcome: 'Retained' }),
      storedEvent('shot-1', { event_type: 'shot', outcome: 'Point', shot_type: 'point', contest_type: null, restart_reason: null }),
      storedEvent('turnover-1', { event_type: 'turnover', outcome: 'Won', contest_type: null, restart_reason: null }),
    ],
    meta: {
      team: 'Clontarf',
      opponent: 'Kilmacud Crokes',
      match_date: '2026-03-25',
      period: 'H1',
      our_goal_at_top: true,
    },
  });

  await page.goto('/');

  const tabs = [/^Kickouts/i, /^Shots/i, /^Turnovers/i];
  for (const tab of tabs) {
    await page.getByRole('button', { name: tab }).click();
    const pitch = page.locator('.pitch-viz-card');
    await expect(pitch).toBeVisible();
    const box = await pitch.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y + box.height).toBeLessThanOrEqual(768);
  }
});
