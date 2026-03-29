<script>
  import { createEventDispatcher } from 'svelte';
  import { defaultMatchDate } from './appShellHelpers.js';

  export let matches = [];
  export let activeMatchId = null;
  export let isMatchClosed = false;

  const dispatch = createEventDispatcher();

  // ── View state ──────────────────────────────────────────────────────────
  let view = 'list'; // 'list' | 'create' | 'edit'
  let draftTeam = '';
  let draftOpponent = '';
  let draftDate = defaultMatchDate();

  $: openMatches = matches
    .filter((m) => m.status === 'open')
    .sort((a, b) => (b.last_event_at || b.created_at || '').localeCompare(a.last_event_at || a.created_at || ''));

  $: recentClosed = matches
    .filter((m) => m.status === 'closed')
    .sort((a, b) => (b.last_event_at || b.closed_at || b.created_at || '').localeCompare(a.last_event_at || a.closed_at || a.created_at || ''))
    .slice(0, 5);

  $: activeMatch = matches.find((m) => m.id === activeMatchId) ?? null;

  function openCreate() {
    draftTeam = activeMatch?.team ?? '';
    draftOpponent = '';
    draftDate = defaultMatchDate();
    view = 'create';
  }

  function openEdit() {
    if (!activeMatch) return;
    draftTeam = activeMatch.team;
    draftOpponent = activeMatch.opponent;
    draftDate = activeMatch.match_date;
    view = 'edit';
  }

  function submitCreate() {
    dispatch('create', { team: draftTeam, opponent: draftOpponent, match_date: draftDate });
    view = 'list';
  }

  function submitEdit() {
    dispatch('edit', { team: draftTeam, opponent: draftOpponent, match_date: draftDate });
    view = 'list';
  }

  function cancel() {
    view = 'list';
  }
</script>

<div class="match-picker" role="dialog" aria-modal="true" aria-label="Match picker">

  {#if view === 'list'}
    <div class="picker-header">
      <span class="picker-title">Match</span>
      <button class="picker-close" on:click={() => dispatch('close')} aria-label="Close match picker">✕</button>
    </div>

    <!-- Current match -->
    {#if activeMatch}
      <div class="current-match">
        <div class="current-match-info">
          <span class="current-label">Current</span>
          <span class="current-name">{activeMatch.team} v {activeMatch.opponent}</span>
          <span class="current-date">{activeMatch.match_date}</span>
          {#if isMatchClosed}
            <span class="status-badge closed">Closed</span>
          {:else}
            <span class="status-badge open">Open</span>
          {/if}
        </div>
        <div class="current-actions">
          {#if !isMatchClosed}
            <button class="action-btn" on:click={openEdit}>Edit</button>
            <button class="action-btn danger" on:click={() => dispatch('close-match')}>Close match</button>
          {:else}
            <button class="action-btn" on:click={() => dispatch('reopen-match')}>Reopen</button>
          {/if}
        </div>
      </div>
    {:else}
      <p class="no-match-hint">No match selected. Create one or pick from the list below.</p>
    {/if}

    <button class="create-btn" on:click={openCreate}>+ New match</button>

    <!-- Open matches -->
    {#if openMatches.length > 0}
      <div class="section-label">Open</div>
      {#each openMatches as m (m.id)}
        <button
          class="match-row {m.id === activeMatchId ? 'active' : ''}"
          on:click={() => dispatch('select', m.id)}
        >
          <span class="row-name">{m.team} v {m.opponent}</span>
          <span class="row-meta">{m.match_date}</span>
        </button>
      {/each}
    {/if}

    <!-- Recent closed -->
    {#if recentClosed.length > 0}
      <div class="section-label">Recent closed</div>
      {#each recentClosed as m (m.id)}
        <button
          class="match-row closed-row {m.id === activeMatchId ? 'active' : ''}"
          on:click={() => dispatch('select', m.id)}
        >
          <span class="row-name">{m.team} v {m.opponent}</span>
          <span class="row-meta">{m.match_date} · Closed</span>
        </button>
      {/each}
    {/if}

    {#if matches.length === 0}
      <p class="empty-hint">No matches yet.</p>
    {/if}

  {:else if view === 'create'}
    <div class="picker-header">
      <span class="picker-title">New match</span>
      <button class="picker-close" on:click={cancel} aria-label="Cancel">✕</button>
    </div>
    <div class="form-stack">
      <label>Team<input bind:value={draftTeam} placeholder="Clontarf" /></label>
      <label>Opponent<input bind:value={draftOpponent} placeholder="Kilmacud Crokes" /></label>
      <label>Date<input type="date" bind:value={draftDate} /></label>
    </div>
    <div class="form-actions">
      <button class="cancel-btn" on:click={cancel}>Cancel</button>
      <button class="save-btn" on:click={submitCreate}>Create</button>
    </div>

  {:else if view === 'edit'}
    <div class="picker-header">
      <span class="picker-title">Edit match</span>
      <button class="picker-close" on:click={cancel} aria-label="Cancel">✕</button>
    </div>
    <div class="form-stack">
      <label>Team<input bind:value={draftTeam} /></label>
      <label>Opponent<input bind:value={draftOpponent} /></label>
      <label>Date<input type="date" bind:value={draftDate} /></label>
    </div>
    <div class="form-actions">
      <button class="cancel-btn" on:click={cancel}>Cancel</button>
      <button class="save-btn" on:click={submitEdit}>Save</button>
    </div>
  {/if}

</div>

<style>
  .match-picker {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    width: 320px;
    max-height: 80svh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid #e5e7eb;
  }
  .picker-title { font-size: 15px; font-weight: 700; color: #111827; }
  .picker-close {
    background: none; border: none; cursor: pointer;
    font-size: 16px; color: #6b7280; padding: 2px 6px; border-radius: 4px;
  }
  .picker-close:hover { background: #f3f4f6; }

  .current-match {
    padding: 12px 16px;
    background: #f0f9ff;
    border-bottom: 1px solid #e5e7eb;
  }
  .current-match-info { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; }
  .current-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; letter-spacing: 0.04em; }
  .current-name { font-size: 14px; font-weight: 700; color: #111827; }
  .current-date { font-size: 12px; color: #6b7280; }
  .current-actions { display: flex; gap: 8px; }

  .status-badge {
    font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .status-badge.open { background: #d1fae5; color: #065f46; }
  .status-badge.closed { background: #fee2e2; color: #991b1b; }

  .action-btn {
    font-size: 12px; font-weight: 600; padding: 5px 12px;
    border: 1px solid #d1d5db; border-radius: 6px; background: #fff;
    cursor: pointer; color: #374151;
  }
  .action-btn:hover { background: #f9fafb; }
  .action-btn.danger { color: #b91c1c; border-color: #fca5a5; }
  .action-btn.danger:hover { background: #fef2f2; }

  .create-btn {
    margin: 12px 16px 4px;
    padding: 9px 14px;
    background: #0f1923; color: #fff;
    border: none; border-radius: 8px;
    font-size: 13px; font-weight: 700; cursor: pointer;
    text-align: left;
  }
  .create-btn:hover { background: #1e2d3d; }

  .section-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    color: #9ca3af; letter-spacing: 0.05em;
    padding: 10px 16px 4px;
  }

  .match-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 16px; border: none; background: none;
    cursor: pointer; width: 100%; text-align: left;
    border-bottom: 1px solid #f3f4f6;
  }
  .match-row:hover { background: #f9fafb; }
  .match-row.active { background: #eff6ff; }
  .row-name { font-size: 13px; font-weight: 600; color: #111827; }
  .row-meta { font-size: 12px; color: #6b7280; flex-shrink: 0; margin-left: 8px; }
  .closed-row .row-name { color: #6b7280; }

  .no-match-hint, .empty-hint {
    font-size: 13px; color: #9ca3af; padding: 12px 16px; margin: 0;
  }

  .form-stack {
    display: flex; flex-direction: column; gap: 12px; padding: 16px;
  }
  .form-stack label {
    display: flex; flex-direction: column; gap: 4px;
    font-size: 12px; font-weight: 600; color: #374151;
  }
  .form-stack input {
    padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px;
    font-size: 14px; color: #111827;
  }
  .form-stack input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }

  .form-actions {
    display: flex; gap: 8px; padding: 0 16px 16px; justify-content: flex-end;
  }
  .cancel-btn {
    padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px;
    background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; color: #374151;
  }
  .save-btn {
    padding: 8px 16px; border: none; border-radius: 6px;
    background: #0f1923; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;
  }
  .save-btn:hover { background: #1e2d3d; }
</style>
