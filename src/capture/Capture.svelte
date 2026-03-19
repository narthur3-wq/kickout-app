<script>
  import Pitch from './Pitch.svelte';
  import { events, meta } from '../stores.js';
  import { onMount } from 'svelte';
  import {
    jerseyNums,
    toMetersX, toMetersY,
    depthFromKickerGoal, sideBand, depthBand, zoneCode
  } from './field.js';

  // Contest options
  const CONTESTS = [
    { key: 'clean', label: 'Clean'   },
    { key: 'break', label: 'Break'   },
    { key: 'foul',  label: 'Foul'    },
    { key: 'out',   label: 'Sideline'}
  ];

  // --- UI state ---
  let side = 'us';             // 'us' | 'opp'
  let contest = 'clean';
  let win = true;

  let landing = { x: NaN, y: NaN };   // tap preview (normalized 0..1)
  let targetPlayer = '';              // our receivers
  let oppReceiver = '';               // opposition receivers

  let overlayFilter = '';             // filter overlays by player/receiver
  let showStats = true;               // show KPI tables

  // Orientation helper: home (us) kicks left→right; opposition kicks right→left
  const goalAtLeftFor = (s) => s === 'us';

  // --- optional wake lock for live use ---
  let lock = null;
  async function ensureWake() {
    if (!$meta.wake_lock || !('wakeLock' in navigator)) return;
    try { lock = await navigator.wakeLock.request('screen'); } catch {}
  }
  onMount(() => {
    ensureWake();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) ensureWake();
    });
  });
  $: $meta; // keep reactive linkage

  // --- pitch interaction ---
  function onLanding(e) { landing = e.detail; }

  // Clear points: visibly resets preview and (confirm) removes all points for the current side
  function clearPoints() {
    landing = { x: NaN, y: NaN };
    if (side === 'us') targetPlayer = ''; else oppReceiver = '';
    const count = $events.filter(e => e.side === side).length;
    if (count > 0 && confirm(`Remove ${count} ${side === 'us' ? 'our' : 'opposition'} kickout point(s)?`)) {
      events.update(list => list.filter(e => e.side !== side));
    }
    navigator.vibrate?.(10);
  }

  function validate() {
    if (Number.isNaN(landing.x) || Number.isNaN(landing.y)) return 'Tap the pitch to set landing.';
    if (side === 'us'  && !targetPlayer) return 'Tap a receiver number (1–25).';
    if (side === 'opp' && !oppReceiver)  return 'Tap an opposition receiver number (1–25).';
    return '';
  }

  // Build and classify event with correct kicking orientation per side
  function buildEvent() {
    const goalAtLeft = goalAtLeftFor(side);          // us: true (L→R), opp: false (R→L)
    const d = depthFromKickerGoal(landing.x, goalAtLeft);

    return {
      id: Date.now(),
      created_at: new Date().toISOString(),
      match_date: new Date().toISOString().slice(0, 10),

      team: $meta.team,
      opponent: $meta.opponent,

      side,                           // 'us' | 'opp'
      contest_type: contest,          // 'clean' | 'break' | 'foul' | 'out'
      win,                            // boolean

      // raw normalized coords
      x: landing.x,
      y: landing.y,

      // metre conversions
      x_m: toMetersX(landing.x),
      y_m: toMetersY(landing.y),

      // classification (now respecting direction per side)
      side_band:  sideBand(landing.y),
      depth_band: depthBand(d),
      zone_code:  zoneCode(landing.x, landing.y, goalAtLeft),

      // retained field; value means "is our goal on the left for this event?"
      kicking_goal_top: goalAtLeft,

      // receiver labels
      target_player:     side === 'us'  ? (targetPlayer || '') : '',
      opponent_receiver: side === 'opp' ? (oppReceiver  || '') : ''
    };
  }

  function saveEvent() {
    const err = validate();
    if (err) { alert(err); return; }
    events.update(list => [buildEvent(), ...list]);
    landing = { x: NaN, y: NaN };
    targetPlayer = '';
    oppReceiver = '';
    navigator.vibrate?.(20);
  }

  function undoLast() { events.update(list => list.slice(1)); }

  function exportCSV() {
    const headers = [
      'id','created_at','match_date','team','opponent',
      'side','contest_type','win','x','y','x_m','y_m',
      'side_band','depth_band','zone_code','kicking_goal_top',
      'target_player','opponent_receiver'
    ];
    const rows = [headers.join(',')].concat(
      $events.map(e => headers.map(h => {
        let v = e[h];
        if (h === 'x_m' || h === 'y_m') v = Math.round(Number(v || 0)); // round metres for export
        return (typeof v === 'number' || typeof v === 'boolean')
          ? String(v)
          : '"' + String(v ?? '').replace(/"/g, '""') + '"';
      }).join(','))
    ).join('\n');

    const url = URL.createObjectURL(new Blob([rows], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'kickouts.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // --- overlays for the pitch (current side, optional filter) ---
  const norm = s => (s || '').trim().toLowerCase();
  $: sideEventsAll = $events.filter(e => e.side === side);
  $: filteredForOverlay = side === 'us'
    ? sideEventsAll.filter(e => overlayFilter ? norm(e.target_player)     === norm(overlayFilter) : true)
    : sideEventsAll.filter(e => overlayFilter ? norm(e.opponent_receiver) === norm(overlayFilter) : true);
  $: overlays = filteredForOverlay.map(e => ({ x: e.x, y: e.y, ct: e.contest_type, side: e.side, win: !!e.win }));

  // --- KPI tables (player/receiver aggregates) ---
  $: ourPlayerStats = (() => {
    const map = new Map(); let total = 0;
    for (const e of $events) {
      if (e.side !== 'us') continue;
      const k = norm(e.target_player); if (!k) continue;
      total++;
      const m = map.get(k) || { label: e.target_player || '—', tot: 0, win: 0 };
      m.tot++; if (e.win) m.win++; map.set(k, m);
    }
    const rows = Array.from(map.values())
      .map(m => ({ ...m, share: total ? Math.round(100 * m.tot / total) : 0 }))
      .sort((a, b) => b.tot - a.tot);
    return { total, rows };
  })();

  $: oppReceiverStats = (() => {
    const map = new Map(); let total = 0;
    for (const e of $events) {
      if (e.side !== 'opp') continue;
      const k = norm(e.opponent_receiver); if (!k) continue;
      total++;
      const m = map.get(k) || { label: e.opponent_receiver || '—', tot: 0, win: 0 };
      m.tot++; if (e.win) m.win++; map.set(k, m);
    }
    const rows = Array.from(map.values())
      .map(m => ({ ...m, share: total ? Math.round(100 * m.tot / total) : 0 }))
      .sort((a, b) => b.tot - a.tot);
    return { total, rows };
  })();

  // chips
  const isChipActive = (n) => side === 'us' ? String(n) === targetPlayer : String(n) === oppReceiver;
  const chooseChip  = (n) => { if (side === 'us') targetPlayer = String(n); else oppReceiver = String(n); };
</script>

<!-- Top row: side + result + contest -->
<div class="row">
  <div class="seg">
    <div class="segbtns">
      <button class:active={side==='us'}  on:click={() => { side='us';  clearPoints(); }}>Us</button>
      <button class:active={side==='opp'} on:click={() => { side='opp'; clearPoints(); }}>Opposition</button>
    </div>
  </div>

  <div class="seg">
    <span class="seglabel">Result</span>
    <div class="segbtns">
      <button class:active={win===true}  on:click={() => win = true}>Win</button>
      <button class:active={win===false} on:click={() => win = false}>Loss</button>
    </div>
  </div>

  <div class="seg">
    <span class="seglabel">Contest</span>
    <div class="segbtns">
      {#each CONTESTS as c}
        <button class:active={contest===c.key} on:click={() => { contest = c.key; }}>{c.label}</button>
      {/each}
    </div>
  </div>
</div>

<!-- Receiver chips -->
<div class="controls">
  <div class="seg">
    <span class="seglabel">{side==='us' ? 'Receivers (tap)' : 'Opp receivers (tap)'}</span>
    <div class="chips-row">
      {#each jerseyNums as n}
        <button
          class="chip"
          class:active={isChipActive(n)}
          aria-pressed={isChipActive(n)}
          on:click={() => chooseChip(n)}
        >{n}</button>
      {/each}
    </div>
  </div>
</div>

<!-- Filters -->
<div class="controls">
  <input bind:value={overlayFilter} placeholder={side==='us' ? 'All players' : 'All opp receivers'} />
  <button on:click={() => overlayFilter=''}>Clear filter</button>
  <button class="ghost" on:click={() => showStats = !showStats}>{showStats ? 'Hide' : 'Show'} stats</button>
</div>

<!-- Pitch + legend -->
<div class="pitch-wrap">
  <Pitch {overlays} {landing} on:landed={onLanding} />
  <div class="pitch-legend">
    <div class="lg-row"><span class="marker">C</span><span>Clean</span></div>
    <div class="lg-row"><span class="marker">B</span><span>Break</span></div>
    <div class="lg-row"><span class="marker">F</span><span>Foul</span></div>
    <div class="lg-row"><span class="marker">S</span><span>Sideline</span></div>
    <div class="lg-row"><span class="swatch win"></span><span>Win</span></div>
    <div class="lg-row"><span class="swatch loss"></span><span>Loss</span></div>
  </div>
</div>

{#if showStats}
  <div class="kpi">
    {#if side === 'us'}
      <div class="kpi-title">By player</div>
      <table class="kpi-table">
        <thead><tr><th>Player</th><th>Att</th><th>Wins</th><th>Win %</th><th>% of kicks</th></tr></thead>
        <tbody>
          {#each ourPlayerStats.rows as p}
            <tr>
              <td>{p.label}</td>
              <td>{p.tot}</td>
              <td>{p.win}</td>
              <td>{p.tot ? Math.round(100 * p.win / p.tot) : 0}%</td>
              <td>{p.share}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <div class="kpi-title">By opposition receiver (their wins)</div>
      <table class="kpi-table">
        <thead><tr><th>Receiver</th><th>Contests</th><th>Wins</th><th>Win %</th><th>% of kicks</th></tr></thead>
        <tbody>
          {#each oppReceiverStats.rows as p}
            <tr>
              <td>{p.label}</td>
              <td>{p.tot}</td>
              <td>{p.win}</td>
              <td>{p.tot ? Math.round(100 * p.win / p.tot) : 0}%</td>
              <td>{p.share}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<!-- Actions -->
<div class="actions-bar">
  <button on:click={clearPoints}>Clear points</button>
  <button class="danger" on:click={undoLast}>Undo</button>
  <button class="primary" on:click={saveEvent}>Save</button>
  <button on:click={exportCSV}>Export CSV</button>
</div>

<style>
  .row{ display:grid; grid-template-columns:auto 1fr 1fr; gap:8px 10px; align-items:end; margin:6px 0 6px; }
  .controls{ display:flex; flex-wrap:wrap; gap:8px 10px; align-items:center; margin:6px 0 8px; }

  .seg{ display:flex; flex-direction:column; gap:4px; }
  .seglabel{ font-weight:700; margin-bottom:2px; }
  .segbtns{ display:flex; gap:6px; }
  .segbtns button{ border-radius:999px; padding:6px 12px; border:1px solid #d1d5db; background:#fff; cursor:pointer; box-shadow:0 1px 0 rgba(0,0,0,.02); }
  .segbtns .active{ background:#111; color:#fff; border-color:#111; }

  input{ padding:6px 10px; border:1px solid #d1d5db; border-radius:10px; }
  button{ padding:6px 12px; border:1px solid #d1d5db; border-radius:10px; background:#fff; cursor:pointer; }
  button:hover{ background:#f6f6f6; }
  .ghost{ background:#fff; border-color:#e5e7eb; }
  .primary{ background:#111; color:#fff; border-color:#111; }
  .danger{ border-color:#b33; color:#b33; }

  .chips-row{ display:flex; gap:6px; flex-wrap:wrap; }
  .chip{
    min-width:34px; height:34px; border-radius:10px;
    border:1px solid #d1d5db; background:#fff; color:#111;
    transition: background .12s, color .12s, border-color .12s, box-shadow .12s;
  }
  .chip.active,
  .chip[aria-pressed="true"]{
    background:#111; color:#fff; border-color:#111;
    box-shadow:0 0 0 2px rgba(17,17,17,.08) inset;
  }

  .pitch-wrap{ position:relative; }
  .pitch-legend{
    position:absolute; top:10px; left:12px;
    display:flex; flex-direction:column; gap:6px;
    background:rgba(255,255,255,.95); color:#111;
    padding:8px 10px; border-radius:12px; border:1px solid #e5e7eb;
    box-shadow:0 2px 4px rgba(0,0,0,.06);
    pointer-events:none; font-size:13px; min-width:120px;
  }
  .lg-row{ display:flex; align-items:center; gap:8px; }
  .marker{ display:inline-grid; place-items:center; width:22px; height:22px; border-radius:50%; border:2px solid #94a3b8; background:#111; color:#fff; font-weight:900; }
  .swatch{ width:16px; height:16px; border-radius:50%; border:1px solid #94a3b8; }
  .swatch.win{ background:#1B5E20; }
  .swatch.loss{ background:#ef4444; }

  .kpi{ margin:10px 0; }
  .kpi-title{ font-weight:700; margin:6px 0 4px; }
  .kpi-table{ border-collapse:collapse; font-size:13px; min-width:420px; }
  .kpi-table th,.kpi-table td{ border:1px solid #e5e7eb; padding:6px 8px; text-align:center; }

  .actions-bar{ position:sticky; bottom:0; background:#fff; border-top:1px solid #eee; padding:8px; display:flex; gap:8px; justify-content:flex-end; z-index:5; }
</style>
