<script>
  import Pitch from './Pitch.svelte';
  import Legend from './Legend.svelte';
  import PlayerScorerTable from './PlayerScorerTable.svelte';
  import TogglePills from './TogglePills.svelte';
  import { events as pending, half } from '$lib/stores.js';

  // Filters (local UI state)
  let teamFilter = 'both';   // 'us' | 'opp' | 'both'
  let outcomes   = {
    goal: true, point: true, two: true,
    wide: true, short: true, blocked: true
  };
  // source filter
  let sourceFilter = { play: true, free: true };

  const successSet = new Set(['goal', 'point', 'two']);
  const safe = (a) => Array.isArray(a) ? a : [];

  // Current-half (or ALL) shots
  $: shotsThisHalf = safe($pending).filter(
    e => e.type === 'shot' && ($half === 'all' ? true : e.half === $half)
  );

  const bySource = (e, sf) => ((e.source === 'free') ? sf.free : sf.play);

  // ✅ pass filters so Svelte tracks dependencies
  function keepByFilters(e, teamFilter, outcomes, sourceFilter) {
    if (teamFilter !== 'both' && e.side !== teamFilter) return false;
    if (!outcomes[e.outcome]) return false;
    if (!bySource(e, sourceFilter)) return false;
    return true;
  }

  // Pitch marks
  $: marks = shotsThisHalf
    .filter(e => keepByFilters(e, teamFilter, outcomes, sourceFilter))
    .map(e => {
      const cls   = `shot ${e.outcome || ''}`;
      const label = e.outcome === 'two' ? '2' : '';
      const shape = e.side === 'opp' ? 'diamond' : null;
      return {
        x: e.nx, y: e.ny, class: cls, label, shape,
        savedOrientationLeft: e.savedOrientationLeft
      };
    });

  // Mini summaries
  function tally(side, teamFilter, outcomes, sourceFilter) {
    const rows = shotsThisHalf
      .filter(e => e.side === side)
      .filter(e => keepByFilters(e, teamFilter, outcomes, sourceFilter));
    let suc = 0, tot = rows.length;
    for (const r of rows) if (successSet.has(r.outcome)) suc++;
    const pct = tot ? Math.round((suc / tot) * 100) : 0;
    return { suc, tot, pct };
  }
  $: usSum  = tally('us',  teamFilter, outcomes, sourceFilter);
  $: oppSum = tally('opp', teamFilter, outcomes, sourceFilter);

  // Per-player tables (respect filters)
  function scorerRows(side, teamFilter, outcomes, sourceFilter) {
    const rows = shotsThisHalf
      .filter(e => e.side === side)
      .filter(e => keepByFilters(e, teamFilter, outcomes, sourceFilter));
    const map = new Map();
    for (const r of rows) {
      const p = Number.isFinite(r.player) ? r.player : 0;
      const rec = map.get(p) || { player:p, g:0, p:0, t2:0, wide:0, short:0, blocked:0, att:0, scores:0 };
      rec.att++;
      if      (r.outcome === 'goal')    { rec.g++;  rec.scores++; }
      else if (r.outcome === 'point')   { rec.p++;  rec.scores++; }
      else if (r.outcome === 'two')     { rec.t2++; rec.scores++; }
      else if (r.outcome === 'wide')    rec.wide++;
      else if (r.outcome === 'short')   rec.short++;
      else if (r.outcome === 'blocked') rec.blocked++;
      map.set(p, rec);
    }
    const arr = [...map.values()];
    arr.sort((a,b) =>
      b.scores - a.scores || b.g - a.g || b.p - a.p || b.t2 - a.t2 || b.att - a.att || a.player - b.player
    );
    return arr;
  }
  $: usRows  = scorerRows('us',  teamFilter, outcomes, sourceFilter);
  $: oppRows = scorerRows('opp', teamFilter, outcomes, sourceFilter);
</script>

<div class="shots-grid">
  <div class="card sidebar">
    <div class="seg" aria-label="Team">
      <button class:active={teamFilter === 'us'}  on:click={() => (teamFilter = 'us')}>Us</button>
      <button class:active={teamFilter === 'opp'} on:click={() => (teamFilter = 'opp')}>Opp</button>
      <button class:active={teamFilter === 'both'} on:click={() => (teamFilter = 'both')}>Both</button>
    </div>

    <TogglePills
      ariaLabel="Shot outcomes"
      bind:model={outcomes}
      items={[
        { key:'goal',    label:'Goal' },
        { key:'point',   label:'Point' },
        { key:'two',     label:'2pt' },
        { key:'wide',    label:'Wide' },
        { key:'short',   label:'Short' },
        { key:'blocked', label:'Blocked' }
      ]}
    />

    <!-- NEW: source pills -->
    <TogglePills
      ariaLabel="Shot source"
      bind:model={sourceFilter}
      items={[
        { key:'play', label:'From play' },
        { key:'free', label:'Free' }
      ]}
    />

    <Legend title="Legend" showTeam={true} showOutcome={true} showContest={false} showCause={false} dense />

    <div class="mini-sum">
      <div>
        <div class="mini-title">Us</div>
        <div class="mini-big">{usSum.pct}%</div>
        <div class="mini-sub">{usSum.suc}/{usSum.tot} successful</div>
      </div>
      <div>
        <div class="mini-title">Opp</div>
        <div class="mini-big">{oppSum.pct}%</div>
        <div class="mini-sub">{oppSum.suc}/{oppSum.tot} successful</div>
      </div>
    </div>
  </div>

  <div class="card pitch-panel">
    <Pitch {marks} />
  </div>

  <div class="tables">
    <PlayerScorerTable title="Top — our scorers"  rows={usRows}  limit={10} />
    <PlayerScorerTable title="Top — opposition scorers" rows={oppRows} limit={10} />
  </div>
</div>

<style>
  .shots-grid {
    display: grid;
    grid-template-columns: 330px 1fr;
    grid-template-rows: auto auto;
    gap: 16px;
  }
  @media (max-width: 1100px) {
    .shots-grid { grid-template-columns: 1fr; grid-template-rows: auto auto auto; }
  }

  .card { background:#fff; border:1px solid #e6ebf1; border-radius:14px; padding:12px; }

  .seg { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
  .seg > button { padding:8px 12px; border-radius:999px; border:1px solid #d8e0ea; background:#f7f9fb; cursor:pointer; font-weight:700; }
  .seg > button.active { background:#0660aa; color:#fff; border-color:#0660aa; }

  .mini-sum {
    margin-top:10px;
    display:grid; grid-template-columns: 1fr 1fr; gap:12px;
  }
  .mini-title { font-weight:700; }
  .mini-big   { font-weight:800; font-size:28px; }
  .mini-sub   { opacity:.75; font-size:13px; }

  .pitch-panel { padding:8px; }

  .tables {
    grid-column: 1 / -1;
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:16px;
  }
  @media (max-width: 960px) { .tables { grid-template-columns: 1fr; } }
</style>
