<script>
  import { createEventDispatcher } from 'svelte';

  export let events = [];
  export let editingId = null;
  export let onExportCSV    = () => {};
  export let onExportView   = () => {};
  export let onExportJSON   = () => {};
  export let onImportJSON   = () => {};

  const dispatch = createEventDispatcher();
</script>

<section class="card">
  <div class="tbl-header">
    <div class="tbl-title">Events <span class="tbl-count">{events.length}</span></div>
    <div class="export-btns">
      <button class="exp-btn" on:click={onExportCSV}>Export CSV</button>
      <button class="exp-btn" on:click={onExportJSON}>Export JSON</button>
      <button class="exp-btn" on:click={onImportJSON}>Import JSON</button>
    </div>
  </div>

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
        {#if events.length === 0}
          <tr><td colspan="15" class="empty-state">No events recorded yet — use the Capture tab to add your first event.</td></tr>
        {/if}
        {#each events as e (e.id)}
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
  .tbl-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
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

  /* ── Table wrapper ── */
  .tablewrap { overflow-x: auto; border: 1px solid #e8eee6; border-radius: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; }
  th {
    padding: 8px 10px; background: #f8faf8; text-align: left;
    font-size: 11px; font-weight: 700; color: #6b7280; letter-spacing: 0.04em; text-transform: uppercase;
    border-bottom: 1px solid #e8eee6; white-space: nowrap; position: sticky; top: 0;
  }
  td { padding: 8px 10px; border-bottom: 1px solid #f2f5f2; color: #374151; white-space: nowrap; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fbf8; }
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

  /* ── Actions ── */
  .actions { display: flex; gap: 4px; justify-content: flex-end; }
  .act-btn {
    padding: 4px 10px; border: 1.5px solid #e5e7eb; border-radius: 6px;
    background: #fff; cursor: pointer; font-size: 12px; font-weight: 600;
    color: #374151; font-family: inherit; transition: all 0.12s;
  }
  .act-btn:hover { background: #f9fafb; border-color: #d1d5db; }
  .act-btn.danger { color: #dc2626; border-color: #fca5a5; }
  .act-btn.danger:hover { background: #fef2f2; }

  /* ── Empty state ── */
  .empty-state {
    text-align: center; padding: 48px 24px; color: #9ca3af; font-size: 14px;
    font-style: normal; line-height: 1.6;
  }

  button { padding: 7px 14px; border: 1.5px solid #e5e7eb; border-radius: 7px; background: #fff; cursor: pointer; font-size: 13px; font-weight: 600; font-family: inherit; transition: all 0.12s; }
  button:hover { background: #f9fafb; }
</style>
