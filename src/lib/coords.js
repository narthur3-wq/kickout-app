/** Pointer normalization + orientation-safe projection helpers */

export function getClientPoint(e) {
  // Support pointer/mouse/touch
  const src = e?.changedTouches?.[0] || e?.touches?.[0] || e;
  return { x: src.clientX, y: src.clientY };
}

export function toNorm(pt, rect) {
  const x = (pt.x - rect.left) / rect.width;
  const y = (pt.y - rect.top)  / rect.height;
  return { x, y };
}

/**
 * Convert normalized (nx,ny) captured under `savedLeft` orientation
 * to normalized display coords under `currentLeft`.
 * We flip horizontally if the left/right changed.
 */
export function toDisplayXY(nx, ny, savedLeft, currentLeft) {
  if (Boolean(savedLeft) === Boolean(currentLeft)) {
    return { x: nx, y: ny };
  }
  // full rotation when switching from left↔right
  return { x: 1 - nx, y: 1 - ny };
}
