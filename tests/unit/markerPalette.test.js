import { describe, expect, it } from 'vitest';
import { analyticsMarkerFill, analyticsMarkerRing } from '../../src/lib/appShellHelpers.js';

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

// Relative luminance, per WCAG.
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// Hue in degrees, for measuring how far apart two marker colours sit.
function hue(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function hueGap(a, b) {
  const raw = Math.abs(hue(a) - hue(b));
  return Math.min(raw, 360 - raw);
}

const shot = (outcome, shotType = null) => ({ event_type: 'shot', outcome, shot_type: shotType });

// The turf the markers are drawn on.
const TURF = '#3d7642';

describe('shot marker palette', () => {
  const goal = analyticsMarkerFill(shot('Goal'));
  const point = analyticsMarkerFill(shot('Point'));
  const wide = analyticsMarkerFill(shot('Wide'));
  const blocked = analyticsMarkerFill(shot('Blocked'));
  const saved = analyticsMarkerFill(shot('Saved'));

  it('keeps every shot marker legible against the turf', () => {
    // The real defect in the old palette. Its markers sat at 1.01-1.53:1
    // against the turf they are drawn on — near-invisible against the
    // background, before hue even came into it.
    for (const [name, colour] of Object.entries({ goal, point, wide, blocked, saved })) {
      expect(contrast(colour, TURF), `${name} (${colour}) on turf`).toBeGreaterThan(2);
    }
  });

  it('separates goal from point by hue', () => {
    // The single most important distinction in the app. Old palette: dark
    // green vs teal, 33 degrees apart and both dark.
    expect(hueGap(goal, point)).toBeGreaterThan(45);
  });

  it('separates wide from blocked by hue', () => {
    // Old palette: amber vs orange, 17 degrees apart.
    expect(hueGap(wide, blocked)).toBeGreaterThan(45);
  });

  it('gives every shot outcome a distinct colour', () => {
    const all = [goal, point, wide, blocked, saved];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('marker rings', () => {
  it('rings a shot that was a goal attempt but did not score', () => {
    expect(analyticsMarkerRing(shot('Wide', 'goal'))).toBe('goal-attempt');
  });

  it('rings a kickout aimed at a named player', () => {
    expect(analyticsMarkerRing({ event_type: 'kickout', target_player: '9' })).toBe('target');
  });

  it('leaves ordinary events unringed', () => {
    expect(analyticsMarkerRing(shot('Point'))).toBeNull();
    expect(analyticsMarkerRing({ event_type: 'kickout', target_player: '' })).toBeNull();
  });
});
