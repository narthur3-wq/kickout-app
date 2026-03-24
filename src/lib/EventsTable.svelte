<script>
  import { createEventDispatcher } from 'svelte';

  export let events = [];
  export let editingId = null;
  export let onExportCSV    = () => {};
  export let onExportView   = (_subset) => {};
  export let onExportJSON   = () => {};
  export let onImportJSON   = () => {};

  const dispatch = createEventDispatcher();

  // ── Filter / sort state ──────────────────────────────────────────────────
  let search    = '';
  let fPeriod   = 'ALL';
  let fType     = 'ALL';
  let fFlagged  = false;
  let sortKey   = 'date_desc'; // date_desc | date_asc | seq_asc | outcome

  const PERIODS = ['ALL','H1','H2','ET'];
  const TYPES   = ['ALL','kickout','shot','turnover'];

  // ── Derived filtered + sorted list ──────────────────────────────────────
  $: filtered = (() => {
    const q = search.trim().toLowerCase();
    let out = events.filter(e => {
      if (fPeriod !== 'ALL' && e.period !== fPeriod) return false;
      if (fType   !== 'ALL' && (e.event_type || 'kickout') !== fType) return false;
      if (fFlagged && !e.flag) return false;
      if (q) {
        const hay = [e.opponent, e.team, e.outcome, e.target_player, e.zone_code, e.restart_reason]
          .map(v => (v ?? '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortKey === 'date_asc')  out = [...out].sort((a, b) => dateOf(a) - dateOf(b));
    if (sortKey === 'date_desc') out = [...out].sort((a, b) => dateOf(b) - dateOf(a));
    if (sortKey === 'seq_asc')   out = [...out].sort((a, b) => (a.ko_sequence ?? 999) - (b.ko_sequence ?? 999));
    if (sortKey === 'outcome')   out = [...out].sort((a, b) => (a.outcome ?? '').localeCompare(b.outcome ?? ''));

    return out;
  })();

  function dateOf(e) {
    return new Date(e.created_at || e.match_date || 0).getTime();
  }

  function clearFilters() {
    search = ''; fPeriod = 'ALL'; fType = 'ALL'; fFlagged = false;
  }

  $: isFiltered = search || fPeriod !== 'ALL' || fType !== 'ALL' || fFlagged;
</script>

<section class="card">
  <!-- ── Header ── -->
  <div class="tbl-header">
    <div class="tbl-title">
      Events
      <span class="tbl-count">
        {#if isFiltered}{filtered.length} / {events.length}{:else}{events.length}{/if}
      </span>
    </div>
    <div class="export-btns">
      {#if isFiltered}
        <button class="exp-btn primary" on:click={() => onExportView(filtered)} title="Export filtered rows as CSV">Export View ({filtered.length})</button>
      {/if}
      <button class="exp-btn" on:click={onExportCSV}>Export All CSV</button>
      <button class="exp-btn" on:click={onExportJSON}>Export JSON</button>
      <button class="exp-btn" on:click={onImportJSON}>Import JSON</button>
    </div>
  </div>

  <!-- ── Filters ── -->
  <div class="filters-row">
    <input
      class="search-input"
      type="search"
      placeholder="Search opponent, outcome, player, zone…"
      bind:value={search}
    />

    <div class="filter-group">
      {#each PERIODS as p (p)}
        <button class="fpill {fPeriod === p ? 'active' : ''}" on:click={() => fPeriod = p}>{p}</button>
      {/each}
    </div>

    <div class="filter-group">
      {#each TYPES as t (t)}
        <button class="fpill {fType === t ? 'active' : ''}" on:click={() => fType = t}>
          {t === 'ALL' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      {/each}
    </div>

    <label class="flag-toggle" title="Show flagged events only">
      <input type="checkbox" bind:checked={fFlagged} /> 🚩 Only
    </label>

    <select class="sort-select" bind:value={sortKey}>
      <option value="date_desc">Newest first</option>
      <option value="date_asc">Oldest first</option>
      <option value="seq_asc">Sequence</option>
      <option value="outcome">Outcome A–Z</option>
    </select>

    {#if isFiltered}
      <button class="clear-btn" on:click={clearFilters}>Clear</button>
    {/if}
  </div>

  <!-- ── Table ── -->
  <div class="tablewrap">
    <table>
      <thead>
        <tr>
          <th>#</th><th>Date</th><th>Per</th><th>Clock</th><th>Type</th><th>Dir</th>
          <th>Outcome</th><th>Contest</th><th>Zone</th><th>Depth m</th>
          <th>Opponent</th><th>Score</th><th>Target</th><th>Flag</th><th></th>
        </tr>
      </thead>
      <tbody>
        {#if filtered.length === 0}
          <tr>
            <td colspan="15" class="empty-state">
              {#if events.length === 0}
                No events recorded yet — use the Capture tab to add your first event.
              {:else}
                No events match the current filters.
                <button class="link-btn" on:click={clearFilters}>Clear filters</button>
              {/if}
            </td>
          </tr>
        {/if}
        {#each filtered as e (e.id)}
          <tr class={editingId === e.id ? 'editing-row' : ''}>
            <td class="num">{e.ko_sequence ?? '—'}</td>
            <td>{e.match_date || (e.created_at||'').slice(0,10)}</td>
            <td class="center">{e.period}</td>
            <td class="mono">{e.clock || '—'}</td>
            <td class="center cap">{e.event_type || 'kickout'}</td>
            <td class="center">{e.direction || 'ours'}</td>
            <td><span class="outcome-badge" data-outcome={e.outcome?.toLowerCase()}>{e.outcome}</span></td>
            <td class="center">{e.contest_type}</td>
            <td class="center mono">{e.zone_code || '—'}</td>
            <td class="num">{e.depth_from_own_goal_m?.toFixed?.(0) ?? '—'}</td>
            <td>{e.opponent || '—'}</td>
            <td class="mono">{e.score_us ? `${e.score_us}–${e.score_them ?? '?'}` : '—'}</td>
            <td class="center">{e.target_player ? '#' + e.target_player : '—'}</td>
            <td class="center">{e.flag ? '🚩' : ''}</td>
            <td class="actions">
              <button class="act-btn" on:click={() => dispatch('load', e)}>Edit</button>
              <button class="act-btn danger" on:click={() => dispatch('delete', e.id)}>✕</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .card { background: #fff; border-radius: 12px; border: 1px solid #e2e8df; padding: 16px 18px; margin-bottom: 14px; }

  /* ── Header ── */
  .tbl-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  .tbl-title { font-size: 16px; font-weight: 800; color: #111827; letter-spacing: -0.02em; margin-right: auto; }
  .tbl-count {
    display: inline-flex; align-items: center; justify-content: center;
    background: #f3f4f6; color: #6b7280; font-size: 11px; font-weight: 700;
    padding: 2px 7px; border-radius: 99px; margin-left: 6px; vertical-align: middle;
  }
  .export-btns { display: flex; gap: 6px; flex-wrap: wrap; }
  .exp-btn {
    padding: 6px 12px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    background: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #4b5563; font-family: inherit; transition: all 0.12s;
  }
  .exp-btn:hover { background: #f9fafb; border-color: #d1d5db; color: #111827; }
  .exp-btn.primary { background: #1c3f8a; color: #fff; border-color: #1c3f8a; }
  .exp-btn.primary:hover { background: #1a3578; }

  /* ── Filters ── */
  .filters-row {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    margin-bottom: 0; padding: 10px 0 12px; border-bottom: 1px solid #f3f4f6;
  }
  .search-input {
    flex: 1; min-width: 180px; padding: 7px 10px; border: 1.5px solid #e5e7eb;
    border-radius: 8px; font-size: 13px; font-family: inherit; color: #111827;
    background: #fafafa; outline: none; transition: border-color 0.15s;
  }
  .search-input:focus { border-color: #1c3f8a; background: #fff; }
  .filter-group { display: flex; gap: 1px; background: #f3f4f6; border-radius: 7px; padding: 2px; }
  .fpill {
    padding: 0 9px; height: 28px; border-radius: 5px; font-size: 12px; font-weight: 700;
    border: none; background: transparent; cursor: pointer; color: #6b7280;
    font-family: inherit; transition: all 0.12s; line-height: 1;
  }
  .fpill.active { background: #fff; color: #111827; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .flag-toggle {
    display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600;
    color: #6b7280; cursor: pointer; white-space: nowrap; user-select: none;
  }
  .flag-toggle input { cursor: pointer; }
  .sort-select {
    padding: 5px 8px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    font-size: 12px; font-family: inherit; color: #4b5563; background: #fff;
    cursor: pointer; outline: none;
  }
  .clear-btn {
    padding: 5px 10px; border: 1.5px solid #fca5a5; border-radius: 7px;
    background: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #dc2626; font-family: inherit; transition: all 0.12s;
  }
  .clear-btn:hover { background: #fef2f2; }

  /* ── Table wrapper ── */
  .tablewrap { overflow-x: auto; border: 1px solid #f0f0f0; border-radius: 8px; margin-top: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  th {
    padding: 8px 10px; background: #f8faf8; text-align: left;
    font-size: 11px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; text-transform: uppercase;
    border-bottom: 1px solid #e8eee6; white-space: nowrap; position: sticky; top: 0;
  }
  td { padding: 8px 10px; border-bottom: 1px solid #f5f5f5; color: #374151; white-space: nowrap; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fafafa; }
  .editing-row td { background: #fefce8; }
  .center { text-align: center; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
  .num { text-align: right; color: #9ca3af; font-size: 12px; }
  .cap { text-transform: capitalize; }

  /* ── Outcome badge ── */
  .outcome-badge {
    display: inline-block; padding: 2px 8px; border-radius: 6px;
    font-size: 11px; font-weight: 700; background: #f3f4f6; color: #374151;
  }
  .outcome-badge[data-outcome="retained"] { background: #dcfce7; color: #166534; }
  .outcome-badge[data-outcome="won"]      { background: #dcfce7; color: #166534; }
  .outcome-badge[data-outcome="lost"]     { background: #fee2e2; color: #991b1b; }
  .outcome-badge[data-outcome="score"]    { background: #dbeafe; color: #1d40af; }
  .outcome-badge[data-outcome="goal"]     { background: #ede9fe; color: #5b21b6; }
  .outcome-badge[data-outcome="point"]    { background: #cffafe; color: #0e7490; }
  .outcome-badge[data-outcome="wide"]     { background: #fef3c7; color: #92400e; }
  .outcome-badge[data-outcome="blocked"]  { background: #fef3c7; color: #78350f; }
  .outcome-badge[data-outcome="saved"]    { background: #f3f4f6; color: #374151; }

  /* ── Actions — low-profile until row hover ── */
  .actions { display: flex; gap: 4px; justify-content: flex-end; }
  .act-btn {
    padding: 4px 10px; border: 1px solid transparent; border-radius: 6px;
    background: transparent; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #d1d5db; font-family: inherit; transition: all 0.12s; opacity: 0.4;
  }
  tr:hover .act-btn { opacity: 1; border-color: #e5e7eb; background: #fff; color: #374151; }
  tr:hover .act-btn:hover { background: #f9fafb; border-color: #d1d5db; }
  tr:hover .act-btn.danger { color: #dc2626; border-color: #fca5a5; }
  tr:hover .act-btn.danger:hover { background: #fef2f2; }

  /* ── Empty / no-results ── */
  .empty-state {
    text-align: center; padding: 48px 24px; color: #9ca3af; font-size: 14px; line-height: 1.6;
  }
  .link-btn {
    background: none; border: none; padding: 0; color: #1c3f8a; font-size: 14px;
    font-weight: 600; cursor: pointer; text-decoration: underline; font-family: inherit;
  }
</style>
