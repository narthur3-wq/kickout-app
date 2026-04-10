import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch } from './appSession.js';

async function clearAnalysisState(page) {
  await page.evaluate(() => {
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
    window.localStorage.removeItem(scopedKey('ko_post_match_analysis'));
    window.localStorage.removeItem(scopedKey('ko_post_match_analysis_sync'));
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
}

async function openPossessionTab(page) {
  await page.getByRole('button', { name: /^Possession$/i }).click();
  await expect(page.getByRole('heading', { name: 'Possession Analysis' })).toBeVisible();
}

async function startDraftSession(page, playerName, { half = null, attackingTop = true } = {}) {
  const playerInput = page.getByPlaceholder('Type a player');
  await playerInput.fill(playerName);

  const sessionConfig = page.locator('.session-config');
  await expect(sessionConfig).toContainText('Attacking direction for this session');
  if (attackingTop) {
    await sessionConfig.getByRole('button', { name: /Our goal at top/i }).click();
  } else {
    await sessionConfig.getByRole('button', { name: /Our goal at bottom/i }).click();
  }
  if (half) {
    await sessionConfig.getByRole('button', { name: new RegExp(half, 'i') }).click();
  }
  await page.getByRole('button', { name: /Start draft session/i }).click();
}

async function addPossessionEvent(page, { outcome, assist = false }) {
  const pitch = page.locator('.draft-box').getByRole('application', { name: /GAA pitch/i });
  await pitch.click();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await page.getByRole('button', { name: outcome, exact: true }).click();
  if (assist) {
    await page.getByRole('checkbox', { name: /Assist/i }).check();
  }

  await page.getByRole('button', { name: /Add draft event/i }).click();
}

test('captures, finalizes, and surfaces score involvement across sessions', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Kilmacud Crokes' });
  await clearAnalysisState(page);
  await openPossessionTab(page);

  await startDraftSession(page, 'Cian Murphy', { half: 'First half', attackingTop: true });
  await addPossessionEvent(page, { outcome: 'Kick pass', assist: true });
  await expect(page.locator('.draft-box')).toContainText('Assist');
  await page.getByRole('button', { name: /Finalize session/i }).click();
  await expect(page.getByText('Session finalized.')).toBeVisible();
  await expect(page.locator('.summary-grid .emphasis')).toContainText('Score involvement');
  await expect(page.locator('.summary-grid .emphasis')).toContainText('1');

  await startDraftSession(page, 'Cian Murphy', { half: 'Second half', attackingTop: false });
  await addPossessionEvent(page, { outcome: 'Score point' });
  await page.getByRole('button', { name: /Finalize session/i }).click();
  await expect(page.getByText('Session finalized.')).toBeVisible();

  await page.getByLabel('Session').selectOption('all');
  await expect(page.locator('.summary-grid .emphasis')).toContainText('Score involvement');
  await expect(page.locator('.summary-grid .emphasis')).toContainText(/\d+/);
  await expect(page.locator('.summary-grid')).toContainText(/assists?/i);
  await expect(page.locator('.summary-grid')).toContainText(/direct/i);
});

test('filters possession sessions by half and keeps the empty state legible', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Na Fianna' });
  await clearAnalysisState(page);
  await openPossessionTab(page);

  await startDraftSession(page, 'Aoife Kelly', { half: 'First half', attackingTop: true });
  await addPossessionEvent(page, { outcome: 'Hand pass' });
  await page.getByRole('button', { name: /Finalize session/i }).click();
  await expect(page.getByText('Session finalized.')).toBeVisible();

  await page.locator('.filter-row[aria-label="Half filter"]').getByRole('button', { name: /^Second half$/i }).click();
  await expect(page.getByText('No sessions logged for this half.')).toBeVisible();

  await page.locator('.filter-row[aria-label="Half filter"]').getByRole('button', { name: /^All halves$/i }).click();
  await expect(page.getByText('Saved Sessions')).toBeVisible();
});

test('captures a carry with a waypoint and logs destination for a kick pass', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Ballyboden St Endas' });
  await clearAnalysisState(page);
  await openPossessionTab(page);

  await startDraftSession(page, 'Sean Brennan', { half: 'First half', attackingTop: true });

  const pitch = page.locator('.draft-box').getByRole('application', { name: /GAA pitch/i });

  // Set receive point
  await pitch.click();

  // Add a carry waypoint
  await page.getByRole('button', { name: /Add waypoint/i }).click();
  await pitch.click();

  // Set release point
  await pitch.click();

  // Choose Kick pass outcome
  await page.getByRole('button', { name: 'Kick pass', exact: true }).click();

  // Set destination (required for Kick pass)
  await pitch.click();

  // Review and save
  await page.getByRole('button', { name: /Review event/i }).click();
  await expect(page.locator('.detail-card')).toContainText('Waypoints');
  await expect(page.locator('.detail-card')).toContainText('1');

  await page.getByRole('button', { name: /Add draft event/i }).click();
  await expect(page.locator('.draft-box')).toContainText('1 event');

  await page.getByRole('button', { name: /Finalize session/i }).click();
  await expect(page.getByText('Session finalized.')).toBeVisible();
});

test('allows editing a saved event receive and release points without deleting it', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'St Judes' });
  await clearAnalysisState(page);
  await openPossessionTab(page);

  await startDraftSession(page, 'Roisin Farrell', { half: 'Second half', attackingTop: false });
  await addPossessionEvent(page, { outcome: 'Score point' });
  await page.getByRole('button', { name: /Finalize session/i }).click();
  await expect(page.getByText('Session finalized.')).toBeVisible();

  // Open the saved event for editing
  const eventCard = page.locator('.event-card').first();
  await eventCard.click();

  // The edit section should appear
  await expect(page.locator('.detail-title')).toContainText(/Edit event/i);

  // Activate receive-point edit mode
  await page.getByRole('button', { name: /Edit receive/i }).click();

  // Tap the pitch to update the receive point
  const analysisPitch = page.locator('.analysis-pitch-frame').getByRole('application', { name: /GAA pitch/i });
  await analysisPitch.click();

  await page.getByRole('button', { name: /Save changes/i }).click();
  await expect(page.locator('.detail-title')).toContainText(/Edit event/i);
});
