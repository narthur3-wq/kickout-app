// Tactical board — pure utilities (no Svelte dependency)
// Coordinate system matches the rest of the app:
//   stored x = side  (0 = top edge, 1 = bottom edge) → SVG y
//   stored y = depth (0 = left goal, 1 = right goal)  → SVG x

export const W = 145; // pitch SVG width
export const H = 90;  // pitch SVG height

export const svgX = (p) => p.y * W;
export const svgY = (p) => p.x * H;

export function pointerToPitch(event, svgEl) {
  const pt = svgEl.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const inv = svgEl.getScreenCTM()?.inverse();
  if (!inv) return null;
  const p = pt.matrixTransform(inv);
  return {
    x: Math.max(0, Math.min(1, p.y / H)),
    y: Math.max(0, Math.min(1, p.x / W)),
  };
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ── Ramer-Douglas-Peucker path simplification ─────────────────────────────

function perpDist(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdpSegment(pts, s, e, eps, out) {
  if (e - s <= 1) return;
  let maxD = 0, idx = s;
  for (let i = s + 1; i < e; i++) {
    const d = perpDist(pts[i], pts[s], pts[e]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > eps) {
    rdpSegment(pts, s, idx, eps, out);
    out.push(idx);
    rdpSegment(pts, idx, e, eps, out);
  }
}

export function rdpSimplify(pts, eps = 2.5) {
  if (pts.length <= 2) return pts;
  const out = [0];
  rdpSegment(pts, 0, pts.length - 1, eps, out);
  out.push(pts.length - 1);
  out.sort((a, b) => a - b);
  return out.map(i => pts[i]);
}

// Convert a raw pitch-coord point array → simplified pitch-coord path.
// RDP is applied in SVG-unit space so epsilon=2.5 means ~1.7m on pitch.
export function simplifyPitchPath(pitchPts, eps = 2.5, maxPts = 40) {
  if (pitchPts.length < 2) return pitchPts;
  const svgPts = pitchPts.map(p => ({ x: p.y * W, y: p.x * H }));
  const simplified = rdpSimplify(svgPts, eps);
  return simplified.slice(0, maxPts).map(p => ({ x: p.y / H, y: p.x / W }));
}

// ── Default GAA 15-a-side formations ─────────────────────────────────────
// Home attacks right (their goal at y≈0). Away mirrors both axes.

const HOME_SPOTS = [
  [1,  0.50, 0.03],
  [2,  0.20, 0.10], [3,  0.50, 0.10], [4,  0.80, 0.10],
  [5,  0.20, 0.22], [6,  0.50, 0.22], [7,  0.80, 0.22],
  [8,  0.38, 0.37], [9,  0.62, 0.37],
  [10, 0.20, 0.58], [11, 0.50, 0.58], [12, 0.80, 0.58],
  [13, 0.20, 0.73], [14, 0.50, 0.73], [15, 0.80, 0.73],
];

const AWAY_SPOTS = HOME_SPOTS.map(([n, x, y]) => [n, 1 - x, 1 - y]);

export function defaultPlayers() {
  return [
    ...HOME_SPOTS.map(([n, x, y]) => ({ id: `home-${n}`, team: 'home', number: n, baseX: x, baseY: y })),
    ...AWAY_SPOTS.map(([n, x, y]) => ({ id: `away-${n}`, team: 'away', number: n, baseX: x, baseY: y })),
  ];
}

// ── Derived playback positions ────────────────────────────────────────────
// Returns Map<playerId, {x, y}> reflecting player positions after all run
// moves in steps 1..upToStep have been fully resolved. Pass moves are visual
// only and never reposition players.
export function derivePositionsAtStep(players, moves, upToStep) {
  const pos = new Map(players.map(p => [p.id, { x: p.baseX, y: p.baseY }]));
  for (const m of moves) {
    if (m.step > upToStep || m.type !== 'run') continue;
    const end = m.path[m.path.length - 1];
    if (end) pos.set(m.playerId, { x: end.x, y: end.y });
  }
  return pos;
}
