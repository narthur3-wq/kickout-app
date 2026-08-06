import { expect, test } from '@playwright/test';
import { openFreshApp, setUpMatch } from './appSession.js';

const BOARD_W = 145;
const BOARD_H = 90;

async function svgPoint(svg, x, y) {
  const box = await svg.boundingBox();
  if (!box) throw new Error('Missing tactical board SVG box');
  const scale = Math.min(box.width / BOARD_W, box.height / BOARD_H);
  const offsetX = (box.width - BOARD_W * scale) / 2;
  const offsetY = (box.height - BOARD_H * scale) / 2;
  return {
    x: box.x + offsetX + x * scale,
    y: box.y + offsetY + y * scale,
  };
}

async function clickSvg(page, svg, x, y) {
  const point = await svgPoint(svg, x, y);
  await page.mouse.click(point.x, point.y);
}

async function dragSvg(page, svg, fromX, fromY, toX, toY) {
  const from = await svgPoint(svg, fromX, fromY);
  const to = await svgPoint(svg, toX, toY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test('tactical board controls stay usable after the visual refactor', async ({ page }) => {
  await openFreshApp(page);
  await setUpMatch(page, { opponent: 'Visual Rovers' });

  await page.getByRole('tab', { name: /^Tools$/i }).click();
  await page.locator('nav.tab-bar').getByRole('tab', { name: /^Board$/i }).click();

  const board = page.getByRole('application', { name: /Tactical board/i });
  await expect(board).toBeVisible();
  const svg = board.locator('svg');
  await expect(svg).toBeVisible();

  await page.getByRole('button', { name: /^Hide player$/i }).click();
  await expect(page.getByRole('button', { name: /^Show all$/i })).toBeEnabled();
  await page.getByRole('button', { name: /^Show all$/i }).click();
  await expect(page.getByRole('button', { name: /^Show all$/i })).toBeDisabled();

  await page.getByRole('button', { name: /^Pass$/i }).click();
  await clickSvg(page, svg, 4.35, 45);
  await clickSvg(page, svg, 14.5, 45);
  await expect(page.getByRole('button', { name: /^Play$/i })).toBeEnabled();

  await page.getByRole('button', { name: /^Run$/i }).click();
  await clickSvg(page, svg, 14.5, 45);
  await dragSvg(page, svg, 26, 45, 40, 34);

  await page.getByRole('button', { name: /^Shot$/i }).click();
  await clickSvg(page, svg, 84.1, 45);
  await clickSvg(page, svg, 141, 45);

  await page.getByRole('button', { name: /^Pen$/i }).click();
  await dragSvg(page, svg, 68, 29, 86, 34);

  await page.getByRole('button', { name: /^Undo$/i }).click();
  await page.getByRole('button', { name: /^Pen$/i }).click();
  await dragSvg(page, svg, 68, 29, 86, 34);
  await page.getByRole('button', { name: /^Erase$/i }).click();
  await clickSvg(page, svg, 76, 32);

  await page.getByRole('button', { name: /^\+$/i }).click();
  await expect(page.getByText(/^Step 2\/2$/i)).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /^Delete step$/i }).click();
  await expect(page.getByText(/^Step 1\/1$/i)).toBeVisible();

  await page.getByRole('button', { name: /^Play$/i }).click();
  await expect(page.getByRole('button', { name: /^Pause$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Play$/i })).toBeVisible({ timeout: 3000 });

  await page.getByRole('button', { name: /^Settings$/i }).click();
  await expect(page.getByLabel('Tactical board settings')).toBeVisible();
  await page.getByRole('button', { name: /^2x$/i }).click();
  await expect(page.getByRole('button', { name: /^2x$/i })).toHaveClass(/active/);

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /^Clear all markings$/i }).click();
  await expect(page.getByRole('button', { name: /^Play$/i })).toBeDisabled();
});
