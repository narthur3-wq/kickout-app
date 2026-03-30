<script>
  import { createEventDispatcher } from 'svelte';

  export let events = [];
  export let editingId = null;
  export let onExportCSV = () => {};
  export let onExportView = (_subset) => {};
  export let onExportJSON = () => {};
  export let onImportJSON = () => {};

  const dispatch = createEventDispatcher();

  let search = '';
  let fPeriod = 'ALL';
  let fType = 'ALL';
  let fFlagged = false;
  let sortKey = 'date_desc';

  const PERIODS = ['ALL', 'H1', 'H2', 'ET'];
  const TYPES = ['ALL', 'kickout', 'shot', 'turnover'];

  function dateOf(event) {
    return new Date(event.created_at || event.match_date || 0).getTime();
  }

  function selectedTeamName(event) {
    return (event.direction || 'ours') === 'ours'
      ? (event.team || 'Ours')
      : (event.opponent || 'Theirs');
  }

  function opposingTeamName(event) {
    return (event.direction || 'ours') === 'ours'
      ? (event.opponent || 'Theirs')
      : (event.team || 'Ours');
  }

  function turnoverPlayersLabel(event) {
    if ((event.event_type || 'kickout') !== 'turnover') {
      return event.target_player ? `#${event.target_player}` : '-';
    }

    const selectedTeam = selectedTeamName(event);
    const opposingTeam = opposingTeamName(event);
    const wonTeam = String(event.outcome || '').toLowerCase() === 'won' ? selectedTeam : opposingTeam;
    const lostTeam = String(event.outcome || '').toLowerCase() === 'lost' ? selectedTeam : opposingTeam;
    const parts = [];

    if (event.turnover_lost_player) parts.push(`Lost ${lostTeam} #${event.turnover_lost_player}`);
    if (event.turnover_won_player) parts.push(`Won ${wonTeam} #${event.turnover_won_player}`);

    return parts.length ? parts.join(' / ') : '-';
  }

  function clearFilters() {
    search = '';
    fPeriod = 'ALL';
    fType = 'ALL';
    fFlagged = false;
  }

  $: filtered = (() => {
    const q = search.trim().toLowerCase();

    let out = events.filter((event) => {
      if (fPeriod !== 'ALL' && event.period !== fPeriod) return false;
      if (fType !== 'ALL' && (event.event_type || 'kickout') !== fType) return false;
      if (fFlagged && !event.flag) return false;

      if (q) {
        const haystack = [
          event.opponent,
          event.team,
          event.outcome,
          event.target_player,
          event.target_player ? `#${event.target_player}` : '',
          event.turnover_lost_player,
          event.turnover_lost_player ? `lost #${event.turnover_lost_player}` : '',
          event.turnover_won_player,
          event.turnover_won_player ? `won #${event.turnover_won_player}` : '',
          turnoverPlayersLabel(event),
          event.zone_code,
          event.restart_reason,
          event.event_type,
          event.direction,
          event.clock,
          event.period,
          event.contest_type,
          event.break_outcome,
          event.shot_type,
          event.match_date,
          event.flag ? 'flag flagged' : '',
        ]
          .map((value) => String(value ?? '').toLowerCase())
          .join(' ');

        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    if (sortKey === 'date_asc') out = [...out].sort((a, b) => dateOf(a) - dateOf(b));
    if (sortKey === 'date_desc') out = [...out].sort((a, b) => dateOf(b) - dateOf(a));
    if (sortKey === 'seq_asc') out = [...out].sort((a, b) => (a.ko_sequence ?? 999) - (b.ko_sequence ?? 999));
    if (sortKey === 'outcome') out = [...out].sort((a, b) => (a.outcome ?? '').localeCompare(b.outcome ?? ''));

    return out;
  })();

  $: isFiltered = Boolean(search || fPeriod !== 'ALL' || fType !== 'ALL' || fFlagged);
</script>

<section class="card">
  <div class="tbl-header">
    <div class="tbl-title">
      Events
      <span class="tbl-count">
        {#if isFiltered}{filtered.length} / {events.length}{:else}{events.length}{/if}
      </span>
    </div>
    <div class="export-btns">
      {#if isFiltered}
        <button class="exp-btn primary" type="button" on:click={() => onExportView(filtered)} title="Export filtered rows as CSV">
          Export View ({filtered.length})
        </button>
      {/if}
      <button class="exp-btn" type="button" on:click={onExportCSV}>Export All CSV</button>
      <button class="exp-btn" type="button" on:click={onExportJSON}>Export JSON</button>
      <button class="exp-btn" type="button" on:click={onImportJSON}>Import JSON</button>
    </div>
  </div>

  <div class="filters-row">
    <input
      class="search-input"
      type="search"
      placeholder="Search type, opponent, clock, player, zone..."
      bind:value={search}
    />

    <div class="filter-group">
      {#each PERIODS as value (value)}
        <button type="button" class="fpill {fPeriod === value ? 'active' : ''}" on:click={() => (fPeriod = value)}>{value}</button>
      {/each}
    </div>

    <div class="filter-group">
      {#each TYPES as value (value)}
        <button type="button" class="fpill {fType === value ? 'active' : ''}" on:click={() => (fType = value)}>
          {value === 'ALL' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)}
        </button>
      {/each}
    </div>

    <label class="flag-toggle" title="Show flagged events only">
      <input type="checkbox" bind:checked={fFlagged} />
      Flagged only
    </label>

    <select class="sort-select" bind:value={sortKey}>
      <option value="date_desc">Newest first</option>
      <option value="date_asc">Oldest first</option>
      <option value="seq_asc">Sequence</option>
      <option value="outcome">Outcome A-Z</option>
    </select>

    {#if isFiltered}
      <button type="button" class="clear-btn" on:click={clearFilters}>Clear</button>
    {/if}

    <span class="scope-note">These filters only change the Events table.</span>
  </div>

  <div class="tablewrap">
    <table aria-label="Events log">
      <thead>
        <tr>
          <th>#</th>
          <th>Date</th>
          <th>Per</th>
          <th>Clock</th>
          <th>Type</th>
          <th>Dir</th>
          <th>Outcome</th>
          <th>Contest</th>
          <th>Zone</th>
          <th>Depth m</th>
          <th>Opponent</th>
          <th>Score</th>
          <th>Players</th>
          <th>Flag</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if filtered.length === 0}
          <tr>
            <td colspan="15" class="empty-state">
              {#if events.length === 0}
                No events recorded yet - use the Capture tab to add your first event.
              {:else}
                No events match the current filters.
                <button type="button" class="link-btn" on:click={clearFilters}>Clear filters</button>
              {/if}
            </td>
          </tr>
        {/if}

        {#each filtered as event (event.id)}
          <tr class={editingId === event.id ? 'editing-row' : ''}>
            <td class="num">{event.ko_sequence ?? '-'}</td>
            <td>{event.match_date || (event.created_at || '').slice(0, 10)}</td>
            <td class="center">{event.period}</td>
            <td class="mono">{event.clock || '-'}</td>
            <td class="center cap">{event.event_type || 'kickout'}</td>
            <td class="center">{event.direction || 'ours'}</td>
            <td><span class="outcome-badge" data-outcome={event.outcome?.toLowerCase()}>{event.outcome}</span></td>
            <td class="center">{event.contest_type || '-'}</td>
            <td class="center mono">{event.zone_code || '-'}</td>
            <td class="num">{event.depth_from_own_goal_m?.toFixed?.(0) ?? '-'}</td>
            <td>{event.opponent || '-'}</td>
            <td class="mono">{event.score_us ? `${event.score_us} / ${event.score_them ?? '?'}` : '-'}</td>
            <td class="players-cell">{turnoverPlayersLabel(event)}</td>
            <td class="center">{event.flag ? 'Flag' : ''}</td>
            <td class="actions">
              <button type="button" class="act-btn" on:click={() => dispatch('load', event)}>Edit</button>
              <button type="button" class="act-btn danger" on:click={() => dispatch('delete', event.id)}>X</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .card {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e2e8df;
    padding: 16px 18px;
    margin-bottom: 14px;
  }

  .tbl-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }

  .tbl-title {
    font-size: 16px;
    font-weight: 800;
    color: #111827;
    letter-spacing: -0.02em;
    margin-right: auto;
  }

  .tbl-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    color: #6b7280;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 99px;
    margin-left: 6px;
    vertical-align: middle;
  }

  .export-btns {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .exp-btn,
  .act-btn,
  .clear-btn,
  .link-btn,
  .fpill {
    font-family: inherit;
  }

  .exp-btn {
    padding: 6px 12px;
    border: 1.5px solid #e5e7eb;
    border-radius: 7px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: #4b5563;
    transition: all 0.12s;
  }

  .exp-btn:hover {
    background: #f9fafb;
    border-color: #d1d5db;
    color: #111827;
  }

  .exp-btn.primary {
    background: #1c3f8a;
    color: #fff;
    border-color: #1c3f8a;
  }

  .exp-btn.primary:hover {
    background: #1a3578;
  }

  .filters-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 0;
    padding: 10px 0 12px;
    border-bottom: 1px solid #f3f4f6;
  }

  .search-input {
    flex: 1;
    min-width: 180px;
    padding: 7px 10px;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    color: #111827;
    background: #fafafa;
    outline: none;
    transition: border-color 0.15s;
  }

  .search-input:focus {
    border-color: #1c3f8a;
    background: #fff;
  }

  .filter-group {
    display: flex;
    gap: 1px;
    background: #f3f4f6;
    border-radius: 7px;
    padding: 2px;
  }

  .fpill {
    padding: 0 9px;
    height: 28px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 700;
    border: none;
    background: transparent;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.12s;
    line-height: 1;
  }

  .fpill.active {
    background: #fff;
    color: #111827;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .flag-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    cursor: pointer;
    white-space: nowrap;
    user-select: none;
  }

  .flag-toggle input {
    cursor: pointer;
  }

  .sort-select {
    padding: 5px 8px;
    border: 1.5px solid #e5e7eb;
    border-radius: 7px;
    font-size: 12px;
    font-family: inherit;
    color: #4b5563;
    background: #fff;
    cursor: pointer;
    outline: none;
  }

  .clear-btn {
    padding: 5px 10px;
    border: 1.5px solid #fca5a5;
    border-radius: 7px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: #dc2626;
    transition: all 0.12s;
  }

  .clear-btn:hover {
    background: #fef2f2;
  }

  .scope-note {
    margin-left: auto;
    font-size: 11px;
    color: #9ca3af;
    font-weight: 600;
  }

  .tablewrap {
    overflow-x: auto;
    border: 1px solid #f0f0f0;
    border-radius: 8px;
    margin-top: 12px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  th {
    padding: 8px 10px;
    background: #f8faf8;
    text-align: left;
    font-size: 11px;
    font-weight: 700;
    color: #6b7280;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-bottom: 1px solid #e8eee6;
    white-space: nowrap;
    position: sticky;
    top: 0;
  }

  td {
    padding: 8px 10px;
    border-bottom: 1px solid #f5f5f5;
    color: #374151;
    white-space: nowrap;
    vertical-align: middle;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: #fafafa;
  }

  .editing-row td {
    background: #fefce8;
  }

  .center {
    text-align: center;
  }

  .mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
  }

  .num {
    text-align: right;
  }

  .players-cell {
    min-width: 220px;
    white-space: normal;
    line-height: 1.4;
  }

  .actions {
    display: flex;
    gap: 6px;
  }

  .act-btn {
    padding: 5px 9px;
    border: 1.5px solid #d1d5db;
    border-radius: 7px;
    background: #fff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: #374151;
    transition: all 0.12s;
  }

  .act-btn:hover {
    background: #f9fafb;
  }

  .act-btn.danger {
    color: #dc2626;
    border-color: #fecaca;
  }

  .act-btn.danger:hover {
    background: #fef2f2;
  }

  .empty-state {
    text-align: center;
    padding: 16px;
    color: #6b7280;
  }

  .link-btn {
    margin-left: 8px;
    border: none;
    background: transparent;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .cap {
    text-transform: capitalize;
  }
</style>
