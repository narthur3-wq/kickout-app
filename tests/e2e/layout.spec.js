import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch, signInIfNeeded } from './appSession.js';

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
  await signInIfNeeded(page);

  // Navigation is two-level: the analytics sub-tabs only exist once the
  // In-game section is open. This test predates that and clicked them
  // straight from Capture, where they do not exist.
  const tabBar = page.locator('nav.tab-bar');
  await tabBar.getByRole('tab', { name: /^In-game$/i }).click();

  const tabs = [/^Kickouts/i, /^Shots/i, /^Turnovers/i];
  for (const tab of tabs) {
    // Scoped to the tab bar: the Live panel also has deep-analysis shortcuts
    // with these same labels, so an unscoped lookup is ambiguous.
    await tabBar.getByRole('tab', { name: tab }).click();
    const pitch = page.locator('.pitch-viz-card');
    await expect(pitch).toBeVisible();
    const box = await pitch.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y + box.height).toBeLessThanOrEqual(768);
  }
});

// Portrait phone was entirely untested, which is how the capture screen shipped
// unusable at phone widths: the form panel took its full content height, the
// pitch collapsed to 0px and Save Event sat below an overflow:hidden boundary
// with nothing to scroll. These assert the three things that were broken.
test.describe('portrait phone capture', () => {
  for (const size of [
    { name: 'small', width: 360, height: 740 },
    { name: 'standard', width: 390, height: 844 },
  ]) {
    test.describe(`${size.name} (${size.width}x${size.height})`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true });

      test('keeps the pitch tappable and the save control in view', async ({ page }) => {
        await openFreshApp(page);
        await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

        const pitch = page.locator('.pitch-card svg');
        await expect(pitch).toBeVisible();

        const pitchBox = await pitch.boundingBox();
        expect(pitchBox).not.toBeNull();
        // The regression was height 0. Anything under ~120px is untappable in
        // practice, so assert a floor rather than merely non-zero.
        expect(pitchBox.height).toBeGreaterThan(120);
        expect(pitchBox.y + pitchBox.height).toBeLessThanOrEqual(size.height);

        const saveButton = page.getByRole('button', { name: /Save Event/i });
        await expect(saveButton).toBeVisible();
        const saveBox = await saveButton.boundingBox();
        expect(saveBox).not.toBeNull();
        expect(saveBox.y).toBeGreaterThanOrEqual(0);
        expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(size.height);
      });

      test('keeps the header to one compact row', async ({ page }) => {
        await openFreshApp(page);
        await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

        const header = page.locator('header.header');
        const headerBox = await header.boundingBox();
        expect(headerBox).not.toBeNull();
        // It grew to 120px when the match name and score wrapped.
        expect(headerBox.height).toBeLessThanOrEqual(64);

        // The wrapped score also rendered on top of the crest and wordmark.
        const overlaps = await page.evaluate(() => {
          const logo = document.querySelector('.logo-wrap')?.getBoundingClientRect();
          if (!logo) return false;
          const others = document.querySelectorAll('.header-center *, .header-actions *');
          return [...others].some((el) => {
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) return false;
            return r.left < logo.right && r.right > logo.left && r.top < logo.bottom && r.bottom > logo.top;
          });
        });
        expect(overlaps).toBe(false);
      });

      test('does not scroll horizontally', async ({ page }) => {
        await openFreshApp(page);
        await setUpMatch(page, { opponent: 'Kilmacud Crokes' });

        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth
        );
        expect(overflows).toBe(false);
      });
    });
  }
});
