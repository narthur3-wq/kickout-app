import { expect, test } from '@playwright/test';

async function openFreshApp(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
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

function storedEvent(id, overrides = {}) {
  return {
    id,
    created_at: '2026-03-25T12:00:00.000Z',
    match_date: '2026-03-25',
    team: 'Clontarf',
    opponent: 'Boden',
    period: 'H1',
    clock: '05:00',
    outcome: 'Retained',
    x: 0.5,
    y: 0.5,
    contest_type: 'clean',
    break_outcome: null,
    pickup_x: null,
    pickup_y: null,
    pickup_x_m: null,
    pickup_y_m: null,
    break_displacement_m: null,
    score_us: '0-0',
    score_them: '0-0',
    flag: false,
    restart_reason: 'Score',
    shot_type: null,
    ko_sequence: 1,
    schema_version: 1,
    event_type: 'kickout',
    direction: 'ours',
    ...overrides,
  };
}

test('captures a live event and restores the match after reload', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page);

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.getByRole('button', { name: /Events/i }).click();
  await expect(page.getByRole('cell', { name: 'Crokes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Retained' })).toBeVisible();

  await page.reload();

  await expect(page.locator('button.match-ctx-bar')).toContainText('Clontarf vs Crokes');
  await page.getByRole('button', { name: /Events/i }).click();
  await expect(page.getByRole('cell', { name: 'Crokes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Retained' })).toBeVisible();
});

test('clear points fully resets the break capture flow on the pitch', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Castleknock' });

  await page.locator('.form-panel').getByRole('button', { name: 'break' }).click();
  await placeLandingPoint(page);
  await expect(page.getByText(/Step 2 — tap pitch for pickup point/i)).toBeVisible();

  await page.getByRole('button', { name: /Clear points/i }).click();
  await placeLandingPoint(page, { x: 260, y: 180 });

  await expect(page.getByText(/Step 2 — tap pitch for pickup point/i)).toBeVisible();
  await expect(page.getByText(/Step 1 — tap pitch for landing point/i)).toHaveCount(0);
});

test('returns to live capture cleanly after editing and cancelling an event', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Vincents' });

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.getByRole('button', { name: /Events/i }).click();
  await page.getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByText(/Editing event/i)).toBeVisible();
  await page.getByRole('button', { name: /Cancel/i }).click();

  await expect(page.getByText(/Editing event/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Clontarf vs Vincents/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Save Event/i })).toBeVisible();
});

test('updates the current match setup without silently splitting saved events', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Crokes' });

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.locator('button.match-ctx-bar').click();
  await page.getByLabel('Opponent').fill('Vincents');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /Events/i }).click();
  await expect(page.getByRole('cell', { name: 'Vincents' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Crokes' })).toHaveCount(0);
});

test('delete all can be recovered with Undo from Capture', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Na Fianna' });

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.getByRole('button', { name: /Events/i }).click();
  await page.getByRole('button', { name: /Delete all/i }).click();
  await page.getByRole('button', { name: /Delete all data/i }).click();

  await expect(page.getByRole('button', { name: /Undo/i })).toBeEnabled();
  await page.getByRole('button', { name: /Undo/i }).click();
  await page.locator('.confirm-card').getByRole('button', { name: 'Undo last change', exact: true }).click();

  await page.getByRole('button', { name: /Events/i }).click();
  await expect(page.getByRole('cell', { name: 'Na Fianna' })).toBeVisible();
});

test('changing period pauses the timer, keeps ends stable, and shows a halftime reminder', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Boden' });

  await expect(page.getByText(/Our goal:/i)).toContainText('left end');
  await expect(page.getByText(/Attacking:/i)).toContainText('right');
  await expect(page.getByText('Paused')).toBeVisible();
  await page.locator('.timer-btn').click();
  await expect(page.getByText('Running')).toBeVisible();
  await page.locator('.form-panel').getByRole('button', { name: 'H2' }).click();

  await expect(page.getByText(/Timer paused/i)).toBeVisible();
  await expect(page.getByText('Paused', { exact: true })).toBeVisible();
  await expect(page.getByText(/Our goal:/i)).toContainText('left end');
  await expect(page.getByText(/Attacking:/i)).toContainText('right');
});

test('header score stays hidden when the current match has no shots', async ({ page }) => {
  const kickoutOnly = storedEvent('kickout-only', { opponent: 'Kilmacud', outcome: 'Retained' });

  await page.addInitScript(({ events, meta }) => {
    window.localStorage.clear();
    window.localStorage.setItem('ko_events', JSON.stringify(events));
    window.localStorage.setItem('ko_meta', JSON.stringify(meta));
    window.localStorage.setItem('ko_sync_queue', JSON.stringify([]));
  }, {
    events: [kickoutOnly],
    meta: {
      team: 'Clontarf',
      opponent: 'Kilmacud',
      match_date: '2026-03-25',
      period: 'H1',
      our_goal_at_top: true,
    },
  });

  await page.goto('/');
  await expect(page.locator('.match-score')).toHaveCount(0);
});

test('header score accepts lowercase imported shot outcomes', async ({ page }) => {
  const lowercaseShot = storedEvent('shot-1', {
    opponent: 'Kilmacud',
    event_type: 'shot',
    outcome: 'point',
    shot_type: 'point',
    contest_type: 'clean',
    direction: 'ours',
  });

  await page.addInitScript(({ events, meta }) => {
    window.localStorage.clear();
    window.localStorage.setItem('ko_events', JSON.stringify(events));
    window.localStorage.setItem('ko_meta', JSON.stringify(meta));
    window.localStorage.setItem('ko_sync_queue', JSON.stringify([]));
  }, {
    events: [lowercaseShot],
    meta: {
      team: 'Clontarf',
      opponent: 'Kilmacud',
      match_date: '2026-03-25',
      period: 'H1',
      our_goal_at_top: true,
    },
  });

  await page.goto('/');
  await expect(page.locator('.match-score')).toContainText('0-1 – 0-0');
});

test('import can keep current conflicting data while still adding brand-new events', async ({ page }) => {
  const existing = storedEvent('existing-1', { opponent: 'Boden', outcome: 'Retained' });
  const conflicting = storedEvent('existing-1', { opponent: 'Na Fianna', outcome: 'Lost' });
  const brandNew = storedEvent('new-2', { opponent: 'Vincents', outcome: 'Score', ko_sequence: 2, x: 0.62 });

  await page.addInitScript(({ events, meta }) => {
    window.localStorage.clear();
    window.localStorage.setItem('ko_events', JSON.stringify(events));
    window.localStorage.setItem('ko_meta', JSON.stringify(meta));
    window.localStorage.setItem('ko_sync_queue', JSON.stringify([]));
  }, {
    events: [existing],
    meta: {
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-25',
      period: 'H1',
      our_goal_at_top: true,
    },
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Events/i }).click();

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import JSON/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify([conflicting, brandNew], null, 2)),
  });

  await expect(page.locator('.confirm-card')).toContainText('Replace those events with the imported versions');
  await page.locator('.confirm-card').getByRole('button', { name: 'Import new only' }).click();

  await expect(page.getByText(/Imported 1 new event\(s\)\. Kept 1 conflicting duplicate\(s\) as current data/i)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Boden' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Vincents' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Na Fianna' })).toHaveCount(0);
});
