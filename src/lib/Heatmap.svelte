<script>
  import { onMount } from 'svelte';
  // Heatmap sits on top of the *same* pitch you use elsewhere
  import Pitch from './Pitch.svelte';

  // points: [{ x:0..1, y:0..1, weight?:number }]
  export let points = [];

  // colour scheme: 'density' (blue→red), 'positive' (→green), 'negative' (→red),
  //               'outcome' (green where won, red where lost — uses point.outcome field)
  export let colorScheme = 'density';

  // tuning
  export let cols = 140;   // grid columns (higher = smoother)
  export let radius = 3;   // per-point influence radius (in grid cells)
  export let smooth = 2;   // gaussian blur passes

  // landscape pitch dimensions (must match Pitch.svelte)
  const W = 145, H = 90;

  let container;   // wrapper around the pitch
  let canvas;      // overlay canvas
  let ro;          // ResizeObserver

  // Positive-outcome outcomes (same set used in AnalyticsPanel)
  const HEAT_POS = new Set(['retained','score','won','goal','point']);

  function draw() {
    if (!container || !canvas) return;

    // Use the ACTUAL rendered size of the pitch SVG below.
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (!points || points.length === 0) return;

    // Build grid in the same aspect as the pitch
    const C = cols;
    const R = Math.round(C * (H / W));

    // For 'outcome' mode we keep separate total/won grids; otherwise a single grid.
    const grid    = Array.from({ length: R }, () => new Float32Array(C));
    const gridWon  = colorScheme === 'outcome'
      ? Array.from({ length: R }, () => new Float32Array(C))
      : null;

    // Splat each point with a small radial kernel
    const r = Math.max(1, Math.floor(radius));
    const sigma2 = (r * 0.65) ** 2;
    for (const p of points) {
      if (!p || isNaN(p.x) || isNaN(p.y)) continue;
      // stored x = side (0–1) → vertical in landscape → row
      // stored y = depth (0–1) → horizontal in landscape → column
      const side  = Math.min(0.999, Math.max(0, p.x));
      const depth = Math.min(0.999, Math.max(0, p.y));
      const cx = Math.floor(depth * C);  // depth → column (horizontal)
      const cy = Math.floor(side  * R);  // side  → row    (vertical)
      const w = p.weight ?? 1;
      const isPos = colorScheme === 'outcome'
        ? HEAT_POS.has((p.outcome || '').toLowerCase())
        : null;
      for (let dy = -r; dy <= r; dy++) {
        const ry = cy + dy; if (ry < 0 || ry >= R) continue;
        for (let dx = -r; dx <= r; dx++) {
          const rx = cx + dx; if (rx < 0 || rx >= C) continue;
          const dist2 = dx*dx + dy*dy;
          const k = Math.exp(-dist2 / (2 * sigma2));
          grid[ry][rx] += w * k;
          if (colorScheme === 'outcome' && isPos) {
            gridWon[ry][rx] += w * k;
          }
        }
      }
    }

    // Separable gaussian blur (5-tap)
    const k = [1,4,6,4,1], ks = 16;
    function blur(data) {
      const h = Array.from({ length: R }, () => new Float32Array(C));
      for (let y=0;y<R;y++) for (let x=0;x<C;x++) {
        h[y][x] = (
          data[y][Math.max(0,x-2)]*k[0] +
          data[y][Math.max(0,x-1)]*k[1] +
          data[y][x]*k[2] +
          data[y][Math.min(C-1,x+1)]*k[3] +
          data[y][Math.min(C-1,x+2)]*k[4]
        ) / ks;
      }
      const v = Array.from({ length: R }, () => new Float32Array(C));
      for (let y=0;y<R;y++) for (let x=0;x<C;x++) {
        v[y][x] = (
          h[Math.max(0,y-2)][x]*k[0] +
          h[Math.max(0,y-1)][x]*k[1] +
          h[y][x]*k[2] +
          h[Math.min(R-1,y+1)][x]*k[3] +
          h[Math.min(R-1,y+2)][x]*k[4]
        ) / ks;
      }
      return v;
    }

    const cellW = cssW / C, cellH = cssH / R;

    if (colorScheme === 'outcome') {
      // Smooth both grids, then colour by win-rate (hue) and density (alpha).
      let smTotal = grid;
      let smWon   = gridWon;
      for (let i = 0; i < smooth; i++) { smTotal = blur(smTotal); smWon = blur(smWon); }

      // Find maxTotal across all cells for alpha normalisation.
      let maxTotal = 0;
      for (let y=0;y<R;y++) for (let x=0;x<C;x++) {
        if (smTotal[y][x] > maxTotal) maxTotal = smTotal[y][x];
      }
      if (maxTotal <= 0) return;

      for (let y=0;y<R;y++) {
        for (let x=0;x<C;x++) {
          const total = smTotal[y][x];
          if (total <= 0) continue;
          const winRate = smWon[y][x] / total;          // 0.0 → 1.0
          const hue     = winRate * 120;                // 0 = red, 120 = green
          const alpha   = 0.12 + 0.78 * (total / maxTotal); // 0.12 → 0.90
          ctx.fillStyle = `hsla(${hue}, 85%, 55%, ${alpha})`;
          ctx.fillRect(x*cellW, y*cellH, cellW+1, cellH+1);
        }
      }
    } else {
      let smoothed = grid;
      for (let i=0;i<smooth;i++) smoothed = blur(smoothed);

      // Normalise and draw
      let max = 0;
      for (let y=0;y<R;y++) for (let x=0;x<C;x++) if (smoothed[y][x] > max) max = smoothed[y][x];
      if (max <= 0) return;

      for (let y=0;y<R;y++) {
        for (let x=0;x<C;x++) {
          const t = Math.sqrt(smoothed[y][x] / max); // lift lows
          if (t <= 0) continue;
          ctx.fillStyle = heatColor(t);
          ctx.fillRect(x*cellW, y*cellH, cellW+1, cellH+1);
        }
      }
    }
  }

  function heatColor(t) {
    const a = Math.min(0.92, 0.12 + t * 0.80);
    if (colorScheme === 'positive') return `hsla(160, 100%, 65%, ${a})`;
    if (colorScheme === 'negative') return `hsla(0, 90%, 65%, ${a})`;
    // density: yellow→orange→red (contrasts against green turf)
    const hue = 60 - t * 60; // 60 (yellow) → 0 (red)
    return `hsla(${hue}, 95%, 58%, ${a})`;
  }

  // Redraw whenever points or colorScheme changes
  $: if (points !== undefined || colorScheme) { draw(); }

  onMount(() => {
    draw();
    ro = new ResizeObserver(draw);
    ro.observe(container);   // redraw when pitch size changes
    return () => ro?.disconnect();
  });
</script>

<style>
  .stack { position: relative; width: 100%; overflow:hidden; }
  .pitch { width:100%; }
  .overlay { position:absolute; inset:0; pointer-events:none; }
  /* ensure the embedded Pitch cannot be clicked in the heatmap */
  .stack :global(svg) { pointer-events: none; }
  .legend {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px 8px;
    background: rgba(0,0,0,0.03);
    font-size: 11px; color: #6b7280;
  }
  .legend-bar {
    flex: 1; height: 8px; border-radius: 4px;
    background: linear-gradient(to right,
      hsla(60,95%,58%,0.15),
      hsla(40,95%,58%,0.50),
      hsla(20,95%,58%,0.72),
      hsla(0,95%,58%,0.92)
    );
  }
  .legend-bar.positive {
    background: linear-gradient(to right, hsla(160,100%,65%,0.05), hsla(160,100%,65%,0.92));
  }
  .legend-bar.negative {
    background: linear-gradient(to right, hsla(0,90%,65%,0.05), hsla(0,90%,65%,0.92));
  }
  .legend-bar.outcome {
    background: linear-gradient(to right,
      hsla(0,85%,55%,0.90),
      hsla(60,85%,55%,0.55),
      hsla(120,85%,55%,0.90)
    );
  }
</style>

<div class="stack">
  <!-- exact same pitch as the main view, just with no markers/overlays -->
  <div class="pitch" bind:this={container}>
    <Pitch
      contestType="clean"
      landing={{x: NaN, y: NaN}}
      pickup={{x: NaN, y: NaN}}
      overlays={[]}
    />
  </div>

  <!-- heatmap canvas perfectly aligned to the SVG above -->
  <canvas class="overlay" bind:this={canvas}></canvas>
</div>

<!-- colour scale legend -->
{#if points && points.length > 0}
  {#if colorScheme === 'outcome'}
    <div class="legend">
      <span>Lost</span>
      <div class="legend-bar outcome"></div>
      <span>Won</span>
    </div>
  {:else}
    <div class="legend">
      <span>Few</span>
      <div class="legend-bar" class:positive={colorScheme === 'positive'} class:negative={colorScheme === 'negative'}></div>
      <span>Many</span>
    </div>
  {/if}
{/if}
