<script>
  import { toDisplayXY } from '$lib/coords.js';
  import { orientation_left } from '$lib/stores.js';

  // [{ x, y, class, label, dataColor, shape, savedOrientationLeft }]
  export let marks = [];
  export let savedOrientationLeft = false; // fallback for legacy callers

  const W = 145, H = 90;
  const mid = W / 2;
  const thin = 0.75, med = 0.9, strong = 1.1;
</script>

<div class="pitch" role="img" aria-label="Gaelic football pitch">
  <svg class="svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
    <!-- perimeter -->
    <rect x="1" y="1" width={W-2} height={H-2} fill="none" stroke="var(--pitch-strong)" stroke-width={strong} rx="1.5" />

    <!-- halfway (solid, thin) -->
    <line x1={mid} y1="1" x2={mid} y2={H-1} stroke="var(--pitch-line)" stroke-width={thin} />

    <!-- 13/20/45 verticals -->
    {#each [13, 20, 45] as d}
      <line x1={d} y1="1" x2={d} y2={H-1} stroke="var(--pitch-line)" stroke-width={thin} />
      <line x1={W-d} y1="1" x2={W-d} y2={H-1} stroke="var(--pitch-line)" stroke-width={thin} />
    {/each}

    <!-- rectangles -->
    <rect x="0.8" y={H/2-9.5} width="6.5" height="19" fill="none" stroke="var(--pitch-strong)" stroke-width={thin}/>
    <rect x="0.8" y={H/2-19}  width="13"  height="38" fill="none" stroke="var(--pitch-strong)" stroke-width={thin}/>
    <rect x={W-6.5-0.8} y={H/2-9.5} width="6.5" height="19" fill="none" stroke="var(--pitch-strong)" stroke-width={thin}/>
    <rect x={W-13-0.8}  y={H/2-19}  width="13"  height="38" fill="none" stroke="var(--pitch-strong)" stroke-width={thin}/>

    <!-- 40m arcs -->
    <path d={`M 0 5 A 40 40 0 0 1 40 45`} fill="none" stroke="var(--pitch-strong)" stroke-width={med}/>
    <path d={`M 40 45 A 40 40 0 0 1 0 85`} fill="none" stroke="var(--pitch-strong)" stroke-width={med}/>
    <path d={`M ${W} 5 A 40 40 0 0 0 ${W-40} 45`} fill="none" stroke="var(--pitch-strong)" stroke-width={med}/>
    <path d={`M ${W-40} 45 A 40 40 0 0 0 ${W} 85`} fill="none" stroke="var(--pitch-strong)" stroke-width={med}/>

    <!-- 13m arcs -->
    <path d={`M 20 32 A 13 13 0 0 1 20 58`} fill="none" stroke="var(--pitch-strong)" stroke-width={thin}/>
    <path d={`M ${W-20} 32 A 13 13 0 0 0 ${W-20} 58`} fill="none" stroke="var(--pitch-strong)" stroke-width={thin}/>
  </svg>

  {#each marks as m, i}
    {#key i}
      {#await Promise.resolve(
        toDisplayXY(
          m.x ?? 0.5, m.y ?? 0.5,
          (m.savedOrientationLeft ?? savedOrientationLeft) ?? true,
          $orientation_left
        )
      ) then p}
        <div class="ovl {m.class ?? ''}" style="left:{p.x*100}%; top:{p.y*100}%;">
          <div
            class="mark"
            data-color={m.dataColor ?? null}
            data-shape={m.shape ?? null}
          >
            <span>{m.label ?? ''}</span>
          </div>
        </div>
      {/await}
    {/key}
  {/each}
</div>

<style>
  .pitch { position: relative; width: 100%; }
  .svg   { display: block; width: 100%; height: auto; }

  .ovl {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .mark {
    width: 14px; height: 14px;
    border-radius: 999px;
    border: 2px solid #fff;
    background: #2b6cb0; /* default */
    display: grid; place-items: center;
    font: 700 8px/1 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    color: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,.15);
  }

  .mark[data-shape="diamond"] { transform: rotate(45deg); border-radius: 2px; }
  .mark[data-shape="diamond"] > span { transform: rotate(-45deg); }

  .mark[data-color="win"]     { background: #16a34a; }
  .mark[data-color="loss"]    { background: #dc2626; }
  .mark[data-color="neutral"] { background: #6b7280; }

  .ovl.ko .mark { width: 16px; height: 16px; }
  .shot.goal    .mark { background: #16a34a; }
  .shot.wide    .mark { background: #6b7280; }
  .shot.blocked .mark { background: #0ea5e9; }
  .shot.two     .mark {
    background: color-mix(in srgb, #0660aa 30%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, #0660aa 30%, transparent);
  }
</style>
