<script>
  import { onMount, afterUpdate } from 'svelte';
  import Pitch from './Pitch.svelte';

  export let points = [];     // [{x,y,weight?}]
  export let cols = 140;
  export let radius = 3;
  export let smooth = 2;

  let container, canvas, ro;

  function draw(){
    if (!container || !canvas) return;
    const cssW = container.clientWidth;
    const cssH = container.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,cssW,cssH);

    if (!points?.length) return;

    const C = cols;
    const R = Math.round(C * (145/90));
    const grid = Array.from({length:R}, ()=> new Float32Array(C));

    const r = Math.max(1, Math.floor(radius));
    const sigma2 = (r*0.65)**2;

    for (const p of points){
      if (!p || isNaN(p.x) || isNaN(p.y)) continue;
      const x = Math.min(0.999, Math.max(0, p.x));
      const y = Math.min(0.999, Math.max(0, p.y));
      const cx = Math.floor(x*C), cy = Math.floor(y*R);
      const w = p.weight ?? 1;
      for (let dy=-r; dy<=r; dy++){
        const ry = cy+dy; if (ry<0 || ry>=R) continue;
        for (let dx=-r; dx<=r; dx++){
          const rx = cx+dx; if (rx<0 || rx>=C) continue;
          const k = Math.exp(-(dx*dx+dy*dy)/(2*sigma2));
          grid[ry][rx] += w*k;
        }
      }
    }

    const k = [1,4,6,4,1], ks=16;
    function blur(data){
      const h = Array.from({length:R}, ()=> new Float32Array(C));
      for (let y=0;y<R;y++) for (let x=0;x<C;x++){
        h[y][x] = (data[y][Math.max(0,x-2)]*k[0] + data[y][Math.max(0,x-1)]*k[1] + data[y][x]*k[2] +
                   data[y][Math.min(C-1,x+1)]*k[3] + data[y][Math.min(C-1,x+2)]*k[4]) / ks;
      }
      const v = Array.from({length:R}, ()=> new Float32Array(C));
      for (let y=0;y<R;y++) for (let x=0;x<C;x++){
        v[y][x] = (h[Math.max(0,y-2)][x]*k[0] + h[Math.max(0,y-1)][x]*k[1] + h[y][x]*k[2] +
                   h[Math.min(R-1,y+1)][x]*k[3] + h[Math.min(R-1,y+2)][x]*k[4]) / ks;
      }
      return v;
    }
    let sm = grid;
    for (let i=0;i<smooth;i++) sm = blur(sm);

    let mx=0; for (let y=0;y<R;y++) for (let x=0;x<C;x++) if (sm[y][x]>mx) mx=sm[y][x];
    if (mx<=0) return;

    const cellW = cssW/C, cellH = cssH/R;
    for (let y=0;y<R;y++){
      for (let x=0;x<C;x++){
        const t = Math.sqrt(sm[y][x]/mx);
        if (t<=0) continue;
        const a = Math.min(0.85, 0.08 + t*0.77);
        const hue = (1-t)*220;
        ctx.fillStyle = `hsla(${hue},85%,50%,${a})`;
        ctx.fillRect(x*cellW, y*cellH, cellW+1, cellH+1);
      }
    }
  }

  onMount(()=>{
    draw();
    ro = new ResizeObserver(draw);
    ro.observe(container);
    return ()=> ro?.disconnect();
  });
  afterUpdate(draw);
</script>

<style>
  .stack{position:relative;width:100%;border:1px solid var(--border);border-radius:6px;overflow:hidden;background:var(--pitch)}
  .pitch{width:100%}
  .overlay{position:absolute;inset:0;pointer-events:none}
  .stack :global(svg){pointer-events:none}
</style>

<div class="stack">
  <div class="pitch" bind:this={container}>
    <Pitch contestType="clean" landing={{x:NaN,y:NaN}} pickup={{x:NaN,y:NaN}} overlays={[]} />
  </div>
  <canvas class="overlay" bind:this={canvas}></canvas>
</div>
