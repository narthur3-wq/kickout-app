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

  await page.getByRole('button', { name: outcome }).click();
  if (assist) {
    await page.getByLabel(/Assist/i).check();
  }

  await page.getByRole('button', { name: /Add draft event/i }).click();
}

test('captures, finalizes, and surfaces score involvement across sessions', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Kilmacud Crokes' });
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
  await expect(page.locator('.summary-grid .emphasis')).toContainText('2');
  await expect(page.locator('.summary-grid')).toContainText('1 assist');
  await expect(page.locator('.summary-grid')).toContainText('1 direct');
});

test('filters possession sessions by half and keeps the empty state legible', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Na Fianna' });
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
