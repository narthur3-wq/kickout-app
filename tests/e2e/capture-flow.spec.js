import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch, signInIfNeeded } from './appSession.js';

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
  await expect(page.getByRole('cell', { name: 'Clontarf' })).toBeVisible();

  await page.reload();

  await expect(page.locator('button.match-ctx-bar')).toContainText('Clontarf vs Crokes');
  await page.getByRole('button', { name: /Events/i }).click();
  await expect(page.getByRole('cell', { name: 'Crokes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Clontarf' })).toBeVisible();
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

test('top navigation can reach Kickouts from the main tabs', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Crokes' });

  const tabsToCheck = [/^Capture/i, /^Live/i, /^Digest/i, /^Events/i];
  const tabBar = page.locator('nav.tab-bar');

  for (const tab of tabsToCheck) {
    await tabBar.getByRole('button', { name: tab }).click();
    await tabBar.getByRole('button', { name: /^Kickouts/i }).click();
    await expect(tabBar.getByRole('button', { name: /^Kickouts/i })).toHaveClass(/active/);
  }

  await tabBar.getByRole('button', { name: /^Shots/i }).click();
  await tabBar.getByRole('button', { name: /^Turnovers/i }).click();
  await tabBar.getByRole('button', { name: /^Kickouts/i }).click();
  await expect(tabBar.getByRole('button', { name: /^Kickouts/i })).toHaveClass(/active/);
});

test.describe('touch navigation', () => {
  test.use({ hasTouch: true, isMobile: false, viewport: { width: 1180, height: 820 } });

  test('touch users can open Kickouts directly from Capture', async ({ page }) => {
    await openFreshApp(page);
    await setUpMatch(page, { opponent: 'Crokes' });

    const kickoutsTab = page.locator('nav.tab-bar').getByRole('button', { name: /^Kickouts/i });
    await kickoutsTab.tap();

    await expect(kickoutsTab).toHaveClass(/active/);
    await expect(page.getByText(/Showing all periods in this view/i)).toBeVisible();
  });

  test('touch users see shot outcomes as selected immediately', async ({ page }) => {
    await openFreshApp(page);
    await setUpMatch(page, { opponent: 'Crokes' });

    const formPanel = page.locator('.form-panel');
    await formPanel.getByRole('button', { name: /^Shot$/i }).tap();

    const pointButton = formPanel.getByRole('button', { name: /^Point$/i });
    await pointButton.tap();

    await expect(pointButton).toHaveClass(/active/);
    await expect(pointButton.locator('.seg-selected-indicator')).toBeVisible();
  });
});

test('captures a turnover with explicit loser and winner players', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Crokes' });

  await page.locator('.form-panel').getByRole('button', { name: /^Turnover$/i }).click();
  await page.getByRole('button', { name: 'Lost' }).click();
  await page.getByLabel(/Lost by \(Clontarf\)/i).fill('2');
  await page.getByLabel(/Won by \(Crokes\)/i).fill('14');
  await placeLandingPoint(page, { x: 260, y: 140 });
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.getByRole('button', { name: /^Events/i }).click();
  await expect(page.getByText(/Lost Clontarf #2 \/ Won Crokes #14/i)).toBeVisible();
});

test('updates the current match setup without silently splitting saved events', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Crokes' });

  await placeLandingPoint(page);
  await page.getByRole('button', { name: /Save Event/i }).click();

  await page.locator('button.match-ctx-bar').click();
  await page.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Opponent').fill('Vincents');
  await page.getByRole('dialog', { name: 'Match picker' }).getByRole('button', { name: 'Update match' }).dispatchEvent('click');
  await page.locator('.confirm-card').getByRole('button', { name: 'Update match', exact: true }).click();

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
  await signInIfNeeded(page);
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
  await signInIfNeeded(page);
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
  await signInIfNeeded(page);
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

test('analytics legends update to match the active tab', async ({ page }) => {
  const kickout = storedEvent('legend-ko', {
    opponent: 'Crokes',
    event_type: 'kickout',
    outcome: 'Retained',
    target_player: '8',
  });
  const shot = storedEvent('legend-shot', {
    opponent: 'Crokes',
    event_type: 'shot',
    outcome: 'Goal',
    shot_type: 'goal',
  });
  const turnover = storedEvent('legend-to', {
    opponent: 'Crokes',
    event_type: 'turnover',
    outcome: 'Won',
  });

  await page.addInitScript(({ events, meta }) => {
    window.localStorage.clear();
    window.localStorage.setItem('ko_events', JSON.stringify(events));
    window.localStorage.setItem('ko_meta', JSON.stringify(meta));
    window.localStorage.setItem('ko_sync_queue', JSON.stringify([]));
  }, {
    events: [kickout, shot, turnover],
    meta: {
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-25',
      period: 'H1',
      our_goal_at_top: true,
    },
  });

  await page.goto('/');
  await signInIfNeeded(page);
  const legend = page.locator('.pitch-viz-legend');

  await page.getByRole('button', { name: /^Shots/i }).click();
  await expect(legend.getByText('Goal attempt')).toBeVisible();
  await expect(legend.getByText('Blocked')).toBeVisible();

  await page.getByRole('button', { name: /^Kickouts/i }).click();
  await expect(legend.getByText('Clontarf')).toBeVisible();
  await expect(legend.getByText('Crokes')).toBeVisible();
  await expect(legend.getByText('Dead-ball / foul')).toBeVisible();
  await expect(legend.getByText('Targeted player')).toBeVisible();
  await expect(legend.getByText('Goal attempt')).toHaveCount(0);

  await page.getByRole('button', { name: /^Turnovers/i }).click();
  await expect(legend.getByText('Won')).toBeVisible();
  await expect(legend.getByText('Lost')).toBeVisible();
  await expect(legend.getByText('Blocked')).toHaveCount(0);
  await expect(legend.getByText('Goal attempt')).toHaveCount(0);
});
