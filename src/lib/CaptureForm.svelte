<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  // ── Metric type + direction ───────────────────────────────────────────
  export let eventType = 'kickout';
  export let direction = 'ours';

  // ── Capture state (all bindable) ──────────────────────────────────────
  export let contest      = 'clean';
  export let outcome      = 'Retained';
  export let breakOutcome = '';
  export let targetPlayer = '';
  export let flagEvent    = false;

  // ── Team context (display-only) ──────────────────────────────────────
  export let team     = '';
  export let opponent = '';

  // ── Break step state (for step guidance) ─────────────────────────────
  export let landingSet = false;
  export let pickupSet  = false;

  // ── Match setup (bindable) ────────────────────────────────────────────
  export let period       = 'H1';

  // ── Read-only props ───────────────────────────────────────────────────
  export let CONTESTS        = [];
  export let BREAK_OUTS      = [];
  export let editingId       = null;
  export let undoStack       = [];

  // ── Restart context (kickout only) ────────────────────────────────────
  export let restartReason = '';
  const RESTART_REASONS = ['Score','Wide','Foul','Out'];

  // ── Shot type (Wide / Blocked goal-attempt flag) ──────────────────────
  export let shotType = 'point'; // 'point' | 'goal'

  // ── Visual feedback ───────────────────────────────────────────────────
  export let savedFlash = false;

  // ── Action callbacks ──────────────────────────────────────────────────
  export let onSave         = () => {};
  export let onClearPoints  = () => {};
  export let onUndoLast     = () => {};

  // ── Outcome sets per event type + direction ───────────────────────────
  const OUTCOME_MAP = {
    'kickout-ours':    ['Retained', 'Lost'],
    'kickout-theirs':  ['Won', 'Lost'],
    'turnover-ours':   ['Won', 'Lost'],
    'turnover-theirs': ['Won', 'Lost'],
    'shot-ours':       ['Goal', 'Point', 'Wide', 'Blocked', 'Saved'],
    'shot-theirs':     ['Goal', 'Point', 'Wide', 'Blocked', 'Saved'],
  };

  $: activeOutcomes = OUTCOME_MAP[`${eventType}-${direction}`] || ['Retained'];

  // Reset outcome when the available options change
  $: if (activeOutcomes.length > 0 && !activeOutcomes.includes(outcome)) {
    outcome = activeOutcomes[0];
  }

  // Reset shotType when outcome is no longer Wide or Blocked
  $: if (outcome !== 'Wide' && outcome !== 'Blocked') shotType = 'point';

  const EVENT_TYPES = ['kickout', 'turnover', 'shot'];
  const JERSEY_NUMS = Array.from({ length: 15 }, (_, i) => i + 1);

  function toggleJersey(num) {
    targetPlayer = targetPlayer === String(num) ? '' : String(num);
  }

  // CSS-safe outcome class (e.g. "Score Conceded" → "score-conceded")
  function outcomeClass(o) {
    return 'outcome-' + o.toLowerCase().replace(/\s+/g, '-');
  }
</script>

<div class="form-content">

  <!-- ── Metric type selector ── -->
  <div class="field-label">Type</div>
  <div class="metric-row">
    {#each EVENT_TYPES as et (et)}
      <button
        class="seg-top {eventType === et ? 'active' : ''}"
        on:click={() => eventType = et}
      >{et}</button>
    {/each}
  </div>

  <!-- ── Direction toggle ── -->
  <div class="field-label">Direction</div>
  <div class="dir-row">
    <button
      class="seg-dir {direction === 'ours' ? 'active' : ''}"
      on:click={() => direction = 'ours'}
    >◀ {team || 'Ours'}</button>
    <button
      class="seg-dir {direction === 'theirs' ? 'active' : ''}"
      on:click={() => direction = 'theirs'}
    >{opponent || 'Theirs'} ▶</button>
  </div>

  <!-- ── Period ── -->
  <div class="field-label">Period</div>
  <div class="dir-row">
    {#each ['H1','H2','ET'] as p (p)}
      <button
        class="seg-dir {period === p ? 'active' : ''}"
        on:click={() => dispatch('periodChange', p)}
      >{p}</button>
    {/each}
  </div>

  <!-- ── Contest (kickout only) ── -->
  {#if eventType === 'kickout'}
    <div class="field-label">Contest</div>
    <div class="btn-group">
      {#each CONTESTS as c (c)}
        <button
          class="seg-btn {contest === c ? 'active' : ''}"
          on:click={() => { contest = c; if (c !== 'break') breakOutcome = ''; }}
        >{c}</button>
      {/each}
    </div>
    {#if contest === 'break'}
      <p class="break-hint {!landingSet ? 'break-hint-step' : (!pickupSet ? 'break-hint-step2' : 'break-hint-done')}">
        {#if !landingSet}
          ● Land &nbsp;<span class="break-hint-dim">○ Pick</span>
        {:else if !pickupSet}
          ✓ Land &nbsp;● Pick
        {:else}
          ✓ Land &nbsp;✓ Pick
        {/if}
      </p>
    {/if}
  {/if}

  <!-- ── Outcome ── -->
  <div class="field-label">Outcome</div>
  <div class="btn-group outcome-grid">
    {#each activeOutcomes as o (o)}
      <button
        class="seg-btn {outcome === o ? 'active ' + outcomeClass(o) : ''}"
        on:click={() => outcome = o}
      >{o}</button>
    {/each}
  </div>

  {#if eventType === 'shot' && (outcome === 'Wide' || outcome === 'Blocked')}
    <div class="shot-type-row">
      <span class="shot-type-label">Goal attempt?</span>
      <div class="shot-type-toggle">
        <button class="stt-btn {shotType === 'point' ? 'stt-active' : ''}"
          on:click={() => shotType = 'point'} type="button">No</button>
        <button class="stt-btn {shotType === 'goal' ? 'stt-active' : ''}"
          on:click={() => shotType = 'goal'} type="button">Yes</button>
      </div>
    </div>
  {/if}

  <!-- ── Break outcome (kickout + break only) ── -->
  {#if eventType === 'kickout' && contest === 'break'}
    <div class="field-label">Who won the break?</div>
    <div class="btn-group">
      {#each BREAK_OUTS as b (b)}
        <button
          class="seg-btn {breakOutcome === b ? 'active' : ''}"
          on:click={() => breakOutcome = b}
        >{b}</button>
      {/each}
    </div>
  {/if}

  <!-- ── Restart context (kickout only) ── -->
  {#if eventType === 'kickout'}
    <div class="field-label">Restart after</div>
    <div class="btn-group">
      {#each RESTART_REASONS as r (r)}
        <button
          class="seg-btn {restartReason === r ? 'active' : ''}"
          on:click={() => restartReason = restartReason === r ? '' : r}
        >{r}</button>
      {/each}
    </div>
  {/if}

  <!-- ── Jersey number grid ── -->
  <div class="field-label">Target player {targetPlayer ? '· #' + targetPlayer : ''}</div>
  <div class="jersey-grid">
    {#each JERSEY_NUMS as num (num)}
      <button
        class="jersey-btn {targetPlayer === String(num) ? 'active' : ''}"
        on:click={() => toggleJersey(num)}
      >{num}</button>
    {/each}
  </div>
  <div class="jersey-custom-row">
    <span class="jersey-custom-label">Other #</span>
    <input
      class="jersey-custom-input"
      type="number" min="1" max="99" placeholder="16+"
      inputmode="numeric"
      value={targetPlayer && parseInt(targetPlayer) > 15 ? targetPlayer : ''}
      on:change={(e) => { targetPlayer = e.target.value || ''; }}
    />
    {#if targetPlayer}
      <button class="jersey-clear" on:click={() => targetPlayer = ''}>✕</button>
    {/if}
  </div>

  <!-- ── Actions ── -->
  {#if editingId}
    <div class="edit-badge">Editing event — tap Update when done</div>
  {/if}
  <div class="action-row">
    <button class="save-cta {savedFlash ? 'save-flash' : editingId ? 'save-edit' : ''}" on:click={onSave}>
      {savedFlash ? '✓ Saved!' : editingId ? 'Update Event' : 'Save Event'}
    </button>
    <div class="sec-row">
      <button class="sec-btn" on:click={onClearPoints}>Clear points</button>
      {#if editingId}
        <button class="sec-btn" on:click={() => dispatch('cancelEdit')}>Cancel</button>
      {/if}
      <button class="sec-btn" on:click={onUndoLast} disabled={undoStack.length === 0} title="Undo last change">↩ Undo last change</button>
      <label class="flag-inline" title="Flag for review"><input type="checkbox" bind:checked={flagEvent}/> ⚑</label>
    </div>
  </div>


</div>

<style>
  .form-content { display: flex; flex-direction: column; padding: 14px 16px 20px; }

  /* ── Section labels ── */
  .field-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: #6b7280; margin: 16px 0 7px;
  }

  /* ── Event type — segmented control ── */
  .metric-row {
    display: flex; gap: 2px; background: #f3f4f6; border-radius: 9px; padding: 3px;
  }
  .seg-top {
    flex: 1; padding: 8px 4px; font-size: 13px; font-weight: 700;
    border: none; border-radius: 7px; background: transparent;
    cursor: pointer; text-transform: capitalize; color: #6b7280;
    font-family: inherit; transition: all 0.15s;
  }
  .seg-top.active {
    background: #fff; color: #1c3f8a;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.05);
  }
  .seg-top:active { transform: scale(0.97); }

  /* ── Direction — segmented control ── */
  .dir-row {
    display: flex; gap: 2px; background: #f3f4f6; border-radius: 9px; padding: 3px;
  }
  .seg-dir {
    flex: 1; padding: 8px 4px; font-size: 13px; font-weight: 700;
    border: none; border-radius: 7px; background: transparent;
    cursor: pointer; color: #6b7280; font-family: inherit; transition: all 0.15s;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 50%;
  }
  .seg-dir.active {
    background: #fff; color: #1c3f8a;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.05);
  }
  .seg-dir:active { transform: scale(0.97); }

  /* ── Break hint ── */
  .break-hint {
    font-size: 12px; font-weight: 600; margin: 4px 0 0;
    padding: 5px 8px; border-radius: 6px; line-height: 1.4;
    background: #f3f4f6; color: #6b7280; border: 1px solid transparent;
  }
  .break-hint-step  { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .break-hint-step2 { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  .break-hint-done  { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  .break-hint-dim   { opacity: 0.45; }

  /* ── Seg buttons (contest / break outcome) ── */
  .btn-group { display: flex; gap: 4px; flex-wrap: wrap; }
  .outcome-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; }
  .seg-btn {
    flex: 1; min-width: 52px; padding: 9px 6px;
    border: 1.5px solid #e5e7eb; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 13px; font-weight: 600;
    color: #374151; font-family: inherit; text-align: center;
    transition: all 0.12s;
  }
  .seg-btn:hover:not(.active) { border-color: #d1d5db; background: #f9fafb; }
  .seg-btn:active { transform: scale(0.96); }
  .seg-btn.active                         { background: #0a5;    color: #fff; border-color: #0a5; }
  .seg-btn.active.outcome-lost            { background: #dc2626; color: #fff; border-color: #dc2626; }
  .seg-btn.active.outcome-score           { background: #2563eb; color: #fff; border-color: #2563eb; }
  .seg-btn.active.outcome-score-conceded  { background: #dc2626; color: #fff; border-color: #dc2626; }
  .seg-btn.active.outcome-won             { background: #16a34a; color: #fff; border-color: #16a34a; }
  .seg-btn.active.outcome-goal            { background: #7c3aed; color: #fff; border-color: #7c3aed; }
  .seg-btn.active.outcome-point           { background: #0891b2; color: #fff; border-color: #0891b2; }
  .seg-btn.active.outcome-wide            { background: #d97706; color: #fff; border-color: #d97706; }
  .seg-btn.active.outcome-blocked         { background: #b45309; color: #fff; border-color: #b45309; }
  .seg-btn.active.outcome-saved           { background: #6b7280; color: #fff; border-color: #6b7280; }
  .seg-btn.active.outcome-foul            { background: #db2777; color: #fff; border-color: #db2777; }
  .seg-btn.active.outcome-out             { background: #7c3aed; color: #fff; border-color: #7c3aed; }

  /* ── Jersey number grid ── */
  .jersey-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; }
  .jersey-btn {
    padding: 7px 2px; font-size: 12px; font-weight: 700; text-align: center;
    border: 1.5px solid #e5e7eb; border-radius: 7px;
    background: #fff; cursor: pointer; color: #374151; font-family: inherit;
    transition: all 0.12s;
  }
  .jersey-btn:hover:not(.active) { border-color: #d1d5db; background: #f9fafb; }
  .jersey-btn:active { transform: scale(0.92); }
  .jersey-btn.active { background: #7c3aed; color: #fff; border-color: #7c3aed; }
  .jersey-custom-row {
    display: flex; align-items: center; gap: 6px; margin-top: 6px;
  }
  .jersey-custom-label { font-size: 11px; font-weight: 700; color: #9ca3af; flex-shrink: 0; }
  .jersey-custom-input {
    padding: 5px 9px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    font-size: 13px; background: #fff; color: #111827; font-family: inherit;
    width: 80px; transition: border-color 0.12s;
  }
  .jersey-custom-input:focus { outline: none; border-color: #1c3f8a; box-shadow: 0 0 0 3px rgba(28,63,138,0.12); }
  .jersey-clear {
    padding: 5px 8px; border: 1.5px solid #fca5a5; border-radius: 7px;
    background: #fff; cursor: pointer; font-size: 11px; color: #dc2626;
    font-family: inherit; transition: all 0.12s;
  }
  .jersey-clear:hover { background: #fef2f2; }
  .label-hint { font-size: 11px; font-weight: 500; color: #9ca3af; }

  /* ── Inline fields (clock, score) ── */
  .inline-fields { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  label { display: flex; gap: 6px; align-items: center; font-size: 13px; color: #4b5563; font-weight: 500; }
  input {
    padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    font-size: 14px; background: #fff; color: #111827; font-family: inherit;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  input:focus {
    outline: none; border-color: #1c3f8a; box-shadow: 0 0 0 3px rgba(28,63,138,0.12);
  }
  input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
  .small { padding: 5px 11px; font-size: 12px; border-radius: 7px; }

  .flag-label { white-space: nowrap; font-size: 12px; font-weight: 600; color: #6b7280; }

  /* ── Action row ── */
  .action-row { display: flex; flex-direction: column; gap: 7px; margin-top: 18px; }
  .save-cta {
    width: 100%; padding: 15px; background: #1c3f8a; color: #fff;
    border: none; border-radius: 10px; font-size: 15px; font-weight: 800;
    cursor: pointer; font-family: inherit; letter-spacing: 0.01em;
    transition: background 0.2s, transform 0.1s; text-align: center;
  }
  .save-cta:hover { background: #163270; }
  .save-cta:active { transform: scale(0.99); }
  .save-cta.save-flash { background: #16a34a; cursor: default; }
  .save-cta.save-edit { background: #b45309; }
  .save-cta.save-edit:hover:not(.save-flash) { background: #92400e; }
  .edit-badge {
    background: #fef3c7; border: 1px solid #fde68a; border-radius: 7px;
    padding: 6px 12px; font-size: 11px; font-weight: 700; color: #92400e;
    margin-bottom: 8px; text-align: center;
  }
  .sec-row { display: flex; gap: 6px; }
  .sec-btn {
    flex: 1; padding: 9px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 13px; font-weight: 600;
    color: #374151; font-family: inherit; text-align: center; transition: all 0.12s;
  }
  .sec-btn:hover { background: #f9fafb; border-color: #d1d5db; }
  .sec-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .flag-inline {
    display: flex; align-items: center; gap: 4px;
    font-size: 13px; color: #9ca3af; cursor: pointer; padding: 0 4px;
    white-space: nowrap;
  }
  .flag-inline input[type="checkbox"] { width: 15px; height: 15px; accent-color: #f59e0b; cursor: pointer; }

  /* Generic button fallback */
  button {
    padding: 8px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 13px; font-weight: 600;
    color: #374151; font-family: inherit; transition: all 0.12s;
  }
  button:hover { background: #f9fafb; }
  button:disabled { opacity: 0.35; cursor: not-allowed; }


  @media (max-width: 480px) {
    .setup-grid { grid-template-columns: 1fr; }
    .outcome-grid { grid-template-columns: repeat(3, 1fr); }
    .form-content { padding: 12px 14px 16px; }
  }

  /* ── Shot type toggle (Wide / Blocked goal-attempt) ── */
  .shot-type-row {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 0;
  }
  .shot-type-label {
    font-size: 11px; font-weight: 700; color: #6b7280;
    text-transform: uppercase; letter-spacing: 0.06em;
  }
  .shot-type-toggle { display: flex; gap: 4px; }
  .stt-btn {
    padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
    border: 1.5px solid #e5e7eb; background: #f9fafb; color: #6b7280;
    cursor: pointer; font-family: inherit; transition: all 0.1s;
  }
  .stt-btn.stt-active {
    background: #1c3f8a; border-color: #1c3f8a; color: #fff;
  }
</style>
