<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let flip = false;
  export let contestType: 'clean'|'break'|'foul'|'out' = 'clean';
  export let landing = { x: NaN, y: NaN };
  export let pickup  = { x: NaN, y: NaN };
  // NEW: overlay points to draw on the pitch (normalized coords)
  // [{ x, y, contest_type, outcome, at_target }]
  export let overlays: Array<any> = [];

  const dispatch = createEventDispatcher();

  // --- Pitch dimensions (m) ---
  const W = 90, H = 145;
  const L13 = 13, L20 = 20, L45 = 45, L65 = 65;
  const SMALL_W = 14, SMALL_D = 4.5, LARGE_W = 19, LARGE_D = 13;
  const R_D = 13, R_40 = 40;
  const cx = W/2;
  const py = (y:number) => (flip ? H - y : y);

  let svgEl: SVGSVGElement;

  function getPoint(evt: MouseEvent) {
    const pt = svgEl.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const inv = svgEl.getScreenCTM()?.inverse(); if (!inv) return {x:NaN,y:NaN};
    const p = pt.matrixTransform(inv);
    return { x: Math.max(0, Math.min(W, p.x)), y: Math.max(0, Math.min(H, p.y)) };
  }

  let awaitingPickup = false;
  function handleClick(e: MouseEvent) {
    const p = getPoint(e);
    const pos = { x: p.x / W, y: p.y / H };
    if (contestType === 'break') {
      if (!awaitingPickup) { awaitingPickup = true;  dispatch('landed', pos); }
      else                 { awaitingPickup = false; dispatch('picked', pos); }
    } else { awaitingPickup = false; dispatch('landed', pos); }
  }

  // keyboard a11y
  let kb = { x: 0.5, y: 0.5 };
  function handleKeydown(e: KeyboardEvent) {
    const s=0.02;
    if (e.key==='ArrowLeft') kb.x=Math.max(0,kb.x-s);
    if (e.key==='ArrowRight')kb.x=Math.min(1,kb.x+s);
    if (e.key==='ArrowUp')   kb.y=Math.max(0,kb.y-s);
    if (e.key==='ArrowDown') kb.y=Math.min(1,kb.y+s);
    if (e.key==='Enter'||e.key===' '){
      e.preventDefault();
      const pos={x:kb.x,y:kb.y};
      if (contestType==='break'){
        if(!awaitingPickup){awaitingPickup=true;dispatch('landed',pos);}
        else{awaitingPickup=false;dispatch('picked',pos);}
      } else { awaitingPickup=false;dispatch('landed',pos); }
    }
  }

  // angle-based arcs
  function arcPath(cx:number, cy:number, r:number, a0:number, a1:number){
    const sx=cx+r*Math.cos(a0), sy=cy+r*Math.sin(a0);
    const ex=cx+r*Math.cos(a1), ey=cy+r*Math.sin(a1);
    const large = Math.abs(a1-a0)>Math.PI ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M ${sx} ${sy} A ${r} ${r} 0 ${large} ${sweep} ${ex} ${ey}`;
  }
  const pathDTop    = () => arcPath(cx, py(L20),       R_D,  Math.PI, 0);
  const pathDBottom = () => arcPath(cx, py(H - L20),   R_D,  0, -Math.PI);
  const path40Top   = () => arcPath(cx, py(0),         R_40, Math.PI, 0);
  const path40Bot   = () => arcPath(cx, py(H),         R_40, 0, -Math.PI);

  const smallX = cx - SMALL_W/2, largeX = cx - LARGE_W/2;

  // --- overlay styling helpers ---
  function outcomeColor(o:string){
    const s = String(o||'').toLowerCase();
    if (s==='score') return '#2563eb';
    if (s==='retained') return '#16a34a';
    if (s==='lost') return '#dc2626';
    return '#6b7280'; // wide/out/foul/other
  }
  const shapeSize = 2.1; // metres in SVG units
  function markerShape(x:number,y:number,type:string,color:string,atTarget:boolean){
    const sx = x*W, sy = (flip ? (1-y):y)*H;
    const s = shapeSize;
    if (type==='break') {
      // triangle
      const p1=`${sx},${sy-s}`, p2=`${sx-s*0.9},${sy+s*0.7}`, p3=`${sx+s*0.9},${sy+s*0.7}`;
      return `<g pointer-events="none">
        <polygon points="${p1} ${p2} ${p3}" fill="${color}" stroke="${color}" stroke-width="0.6"/>
        ${atTarget ? `<circle cx="${sx}" cy="${sy}" r="${s*1.2}" fill="none" stroke="#7c3aed" stroke-width="0.8"/>` : ''}
      </g>`;
    }
    if (type==='foul') {
      // diamond
      const p1=`${sx},${sy-s}`, p2=`${sx-s},${sy}`, p3=`${sx},${sy+s}`, p4=`${sx+s},${sy}`;
      return `<g pointer-events="none">
        <polygon points="${p1} ${p2} ${p3} ${p4}" fill="${color}" stroke="${color}" stroke-width="0.6"/>
        ${atTarget ? `<circle cx="${sx}" cy="${sy}" r="${s*1.2}" fill="none" stroke="#7c3aed" stroke-width="0.8"/>` : ''}
      </g>`;
    }
    if (type==='out') {
      // square
      const r = s*0.9;
      return `<g pointer-events="none">
        <rect x="${sx-r}" y="${sy-r}" width="${2*r}" height="${2*r}" fill="${color}" stroke="${color}" stroke-width="0.6"/>
        ${atTarget ? `<circle cx="${sx}" cy="${sy}" r="${s*1.2}" fill="none" stroke="#7c3aed" stroke-width="0.8"/>` : ''}
      </g>`;
    }
    // clean → circle
    return `<g pointer-events="none">
      <circle cx="${sx}" cy="${sy}" r="${s*0.9}" fill="${color}" stroke="${color}" stroke-width="0.6"/>
      ${atTarget ? `<circle cx="${sx}" cy="${sy}" r="${s*1.2}" fill="none" stroke="#7c3aed" stroke-width="0.8"/>` : ''}
    </g>`;
  }
</script>

<style>
  .grid   { stroke:#a2acb3; stroke-width:.45; opacity:.7 }
  .grid65 { stroke:#98a3aa; stroke-width:.45; opacity:.6; stroke-dasharray:3 3 }
  .main   { stroke:#1d1d1d; stroke-width:.9 }
  .rect   { stroke:#1d1d1d; stroke-width:.9; fill:none }
  .darc   { stroke:#444;    stroke-width:.9; fill:none }
  .arc40  { stroke:#666;    stroke-width:.9; fill:none; stroke-dasharray:4 3 }
  .dot    { fill:#111 }
  .pick   { fill:#444 }
  .overlay { pointer-events:none } /* so clicks pass through */
</style>

<div class="w-full">
  <svg
    bind:this={svgEl}
    viewBox={`0 0 ${W} ${H}`}
    class="w-full"
    style="touch-action:manipulation; user-select:none; background:#eaf4ef; border:1px solid #0a5; border-radius:6px;"
    role="img"
    aria-label="GAA pitch — click or use arrow keys; Enter/Space to set a point"
    tabindex="0"
    on:click={handleClick}
    on:keydown={handleKeydown}
  >
    <!-- boundary -->
    <rect x="0" y="0" width={W} height={H} fill="transparent" />
    <!-- halfway -->
    <line x1="0" y1={py(H/2)} x2={W} y2={py(H/2)} class="main" />
    <!-- 13 / 20 / 45 / 65 from each end -->
    {#each [L13, L20, L45, L65, H-L65, H-L45, H-L20, H-L13] as y, i}
      <line x1="0" y1={py(y)} x2={W} y2={py(y)} class={i===3||i===4 ? 'grid65' : 'grid'} />
    {/each}
    <!-- vertical thirds -->
    <line x1={W/3} y1="0" x2={W/3} y2={H} class="grid" />
    <line x1={(2*W)/3} y1="0" x2={(2*W)/3} y2={H} class="grid" />
    <!-- goal rectangles -->
    <rect x={smallX} y={py(0)}           width={SMALL_W} height={SMALL_D} class="rect" />
    <rect x={largeX} y={py(0)}           width={LARGE_W} height={LARGE_D} class="rect" />
    <rect x={smallX} y={py(H - SMALL_D)} width={SMALL_W} height={SMALL_D} class="rect" />
    <rect x={largeX} y={py(H - LARGE_D)} width={LARGE_W} height={LARGE_D} class="rect" />
    <!-- 13 m D -->
    <path d={pathDTop()} class="darc" />
    <path d={pathDBottom()} class="darc" />
    <!-- 40 m arcs -->
    <path d={path40Top()} class="arc40" />
    <path d={path40Bot()} class="arc40" />

    <!-- current landing/pickup markers -->
    {#if !Number.isNaN(landing.x) && !Number.isNaN(landing.y)}
      <circle cx={landing.x*W} cy={(flip ? (1-landing.y) : landing.y)*H} r="1.8" class="dot" />
    {/if}
    {#if !Number.isNaN(pickup.x) && !Number.isNaN(pickup.y)}
      <circle cx={pickup.x*W} cy={(flip ? (1-pickup.y) : pickup.y)*H} r="1.8" class="pick" />
      <line x1={landing.x*W} y1={(flip ? (1-landing.y) : landing.y)*H}
            x2={pickup.x*W}  y2={(flip ? (1-pickup.y)  : pickup.y)*H}
            stroke="#444" stroke-dasharray="2 2" stroke-width="0.7" />
    {/if}

    <!-- overlays -->
    <g class="overlay">
      {@html overlays.map(o => markerShape(
        o.x, o.y, String(o.contest_type||'clean'),
        outcomeColor(o.outcome), !!o.at_target
      )).join('')}
    </g>

    <!-- keyboard crosshair -->
    <circle cx={kb.x*W} cy={(flip ? (1-kb.y) : kb.y)*H} r="1.1" fill="none" stroke="#666" stroke-width="0.6" />
  </svg>
</div>
