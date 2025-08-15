<script>
  import { onMount, afterUpdate } from 'svelte';
  // Heatmap sits on top of the *same* pitch you use elsewhere
  import Pitch from './Pitch.svelte';

  // points: [{ x:0..1, y:0..1, weight?:number }]
  export let points = [];

  // tuning
  export let cols = 140;   // grid columns (higher = smoother)
  export let radius = 3;   // per-point influence radius (in grid cells)
  export let smooth = 2;   // gaussian blur passes

  // the pitch logical size (must match Pitch.svelte)
  const W = 90, H = 145;

  let container;   // wrapper around the pitch
  let canvas;      // overlay canvas
  let ro;          // ResizeObserver

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
    const grid = Array.from({ length: R }, () => new Float32Array(C));

    // Splat each point with a small radial kernel
    const r = Math.max(1, Math.floor(radius));
    const sigma2 = (r * 0.65) ** 2;
    for (const p of points) {
      if (!p || isNaN(p.x) || isNaN(p.y)) continue;
      const x = Math.min(0.999, Math.max(0, p.x));
      const y = Math.min(0.999, Math.max(0, p.y));
      const cx = Math.floor(x * C);
      const cy = Math.floor(y * R);
      const w = p.weight ?? 1;
      for (let dy = -r; dy <= r; dy++) {
        const ry = cy + dy; if (ry < 0 || ry >= R) continue;
        for (let dx = -r; dx <= r; dx++) {
          const rx = cx + dx; if (rx < 0 || rx >= C) continue;
          const dist2 = dx*dx + dy*dy;
          const k = Math.exp(-dist2 / (2 * sigma2));
          grid[ry][rx] += w * k;
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
    let smoothed = grid;
    for (let i=0;i<smooth;i++) smoothed = blur(smoothed);

    // Normalise and draw
    let max = 0;
    for (let y=0;y<R;y++) for (let x=0;x<C;x++) if (smoothed[y][x] > max) max = smoothed[y][x];
    if (max <= 0) return;

    const cellW = cssW / C, cellH = cssH / R;
    for (let y=0;y<R;y++) {
      for (let x=0;x<C;x++) {
        const t = Math.sqrt(smoothed[y][x] / max); // lift lows
        if (t <= 0) continue;
        ctx.fillStyle = heatColor(t);
        ctx.fillRect(x*cellW, y*cellH, cellW+1, cellH+1);
      }
    }
  }

  function heatColor(t) {
    // blue→cyan→lime→yellow→red with rising alpha
    const a = Math.min(0.85, 0.08 + t * 0.77);
    const hue = (1 - t) * 220;
    return `hsla(${hue}, 85%, 50%, ${a})`;
  }

  onMount(() => {
    draw();
    ro = new ResizeObserver(draw);
    ro.observe(container);   // redraw when pitch size changes
    return () => ro?.disconnect();
  });
  afterUpdate(draw);
</script>

<style>
  .stack { position: relative; width: 100%; border:1px solid #0a5; border-radius:6px; overflow:hidden; }
  .pitch { width:100%; }
  .overlay { position:absolute; inset:0; pointer-events:none; }
  /* ensure the embedded Pitch cannot be clicked in the heatmap */
  .stack :global(svg) { pointer-events: none; }
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
