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
  export let clock        = '';
  export let timerRunning = false;
  export let scoreUs      = '';
  export let scoreThem    = '';
  export let notes        = '';
  export let flagEvent    = false;

  // ── Match setup (bindable) ────────────────────────────────────────────
  export let setupOpen    = true;
  export let team         = '';
  export let opponent     = '';
  export let matchDate    = new Date().toISOString().slice(0, 10);
  export let period       = 'H1';
  export let ourGoalAtTop = true;

  // ── Read-only props ───────────────────────────────────────────────────
  export let CONTESTS        = [];
  export let BREAK_OUTS      = [];
  export let opponentChoices = [];
  export let editingId       = null;
  export let undoStack       = [];

  // ── Visual feedback ───────────────────────────────────────────────────
  export let savedFlash = false;

  // ── Action callbacks ──────────────────────────────────────────────────
  export let onSave         = () => {};
  export let onClearPoints  = () => {};
  export let onUndoLast     = () => {};
  export let onToggleTimer  = () => {};
  export let onPersist      = () => {};

  // ── Outcome sets per event type + direction ───────────────────────────
  const OUTCOME_MAP = {
    'kickout-ours':    ['Retained', 'Lost', 'Score', 'Wide', 'Out', 'Foul'],
    'kickout-theirs':  ['Won', 'Lost', 'Wide', 'Out', 'Foul'],
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

  const EVENT_TYPES = ['kickout', 'turnover', 'shot'];
  const JERSEY_NUMS = Array.from({ length: 25 }, (_, i) => i + 1);

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
    {#each EVENT_TYPES as et}
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
    >◀ Ours</button>
    <button
      class="seg-dir {direction === 'theirs' ? 'active' : ''}"
      on:click={() => direction = 'theirs'}
    >Theirs ▶</button>
  </div>

  <!-- ── Contest (kickout only) ── -->
  {#if eventType === 'kickout'}
    <div class="field-label">Contest</div>
    <div class="btn-group">
      {#each CONTESTS as c}
        <button
          class="seg-btn {contest === c ? 'active' : ''}"
          on:click={() => { contest = c; if (c !== 'break') breakOutcome = ''; }}
        >{c}</button>
      {/each}
    </div>
  {/if}

  <!-- ── Outcome ── -->
  <div class="field-label">Outcome</div>
  <div class="btn-group outcome-grid">
    {#each activeOutcomes as o}
      <button
        class="seg-btn {outcome === o ? 'active ' + outcomeClass(o) : ''}"
        on:click={() => outcome = o}
      >{o}</button>
    {/each}
  </div>

  <!-- ── Break outcome (kickout + break only) ── -->
  {#if eventType === 'kickout' && contest === 'break'}
    <div class="field-label">Break outcome</div>
    <div class="btn-group">
      {#each BREAK_OUTS as b}
        <button
          class="seg-btn {breakOutcome === b ? 'active' : ''}"
          on:click={() => breakOutcome = b}
        >{b}</button>
      {/each}
    </div>
  {/if}

  <!-- ── Jersey number grid ── -->
  <div class="field-label">Target player {targetPlayer ? '· #' + targetPlayer : ''}</div>
  <div class="jersey-grid">
    {#each JERSEY_NUMS as num}
      <button
        class="jersey-btn {targetPlayer === String(num) ? 'active' : ''}"
        on:click={() => toggleJersey(num)}
      >{num}</button>
    {/each}
  </div>
  <div class="jersey-custom-row">
    <span class="jersey-custom-label">#26+</span>
    <input
      class="jersey-custom-input"
      type="number" min="1" max="99" placeholder="other #"
      inputmode="numeric"
      value={targetPlayer && parseInt(targetPlayer) > 25 ? targetPlayer : ''}
      on:change={(e) => { targetPlayer = e.target.value || ''; }}
    />
    {#if targetPlayer}
      <button class="jersey-clear" on:click={() => targetPlayer = ''}>✕</button>
    {/if}
  </div>

  <!-- ── Clock & timer ── -->
  <div class="inline-fields">
    <label>Clock
      <input bind:value={clock} placeholder="12:34" inputmode="numeric" style="width:72px"/>
    </label>
    <button class="small" on:click={onToggleTimer}>{timerRunning ? '⏹ Stop' : '▶ Go'}</button>
  </div>

  <!-- ── Score ── -->
  <div class="inline-fields">
    <label>Score <span class="label-hint">goals-pts e.g. 1-10</span>
      <input bind:value={scoreUs}   placeholder="Us" style="width:54px"/>
      <span style="margin:0 4px">–</span>
      <input bind:value={scoreThem} placeholder="Them" style="width:54px"/>
    </label>
  </div>

  <!-- ── Notes & flag ── -->
  <div class="notes-row">
    <textarea bind:value={notes} placeholder="Note…" rows="2"></textarea>
    <label class="flag-label">
      <input type="checkbox" bind:checked={flagEvent}/> Flag
    </label>
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
      <button class="sec-btn" on:click={onClearPoints}>Clear</button>
      {#if editingId}
        <button class="sec-btn" on:click={() => dispatch('cancelEdit')}>Cancel</button>
      {/if}
      <button class="sec-btn" on:click={onUndoLast} disabled={undoStack.length === 0} title="Undo last save">↩ Undo</button>
    </div>
  </div>

  <!-- ── Match setup (collapsible) ── -->
  <details bind:open={setupOpen} class="setup-details">
    <summary>Match setup
      <span class="setup-summary">{team || '?'} vs {opponent || '?'} · {matchDate} · {period}</span>
    </summary>
    <div class="setup-grid">
      <label>Team     <input bind:value={team}     placeholder="Clontarf"/></label>
      <label>Opponent
        <input bind:value={opponent} placeholder="Crokes" on:change={onPersist} list="opps"/>
        <datalist id="opps">
          {#each opponentChoices as [,lbl]}<option value={lbl}></option>{/each}
        </datalist>
      </label>
      <label>Date     <input type="date" bind:value={matchDate}/></label>
      <label>Period
        <select bind:value={period}>
          <option>H1</option><option>H2</option><option>ET</option>
        </select>
      </label>
      <label class="full-row">
        <input type="checkbox" bind:checked={ourGoalAtTop}/> Our goal at left end
      </label>
    </div>
  </details>

</div>

<style>
  .form-content { display: flex; flex-direction: column; padding: 14px 16px 20px; }

  /* ── Section labels ── */
  .field-label {
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
    text-transform: uppercase; color: #9ca3af; margin: 16px 0 7px;
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
  }
  .seg-dir.active {
    background: #fff; color: #1c3f8a;
    box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 0 0 0.5px rgba(0,0,0,0.05);
  }
  .seg-dir:active { transform: scale(0.97); }

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
  .label-hint { font-size: 10px; font-weight: 500; color: #9ca3af; }

  /* ── Inline fields (clock, score) ── */
  .inline-fields { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  label { display: flex; gap: 6px; align-items: center; font-size: 13px; color: #4b5563; font-weight: 500; }
  input, select {
    padding: 7px 10px; border: 1.5px solid #e5e7eb; border-radius: 7px;
    font-size: 14px; background: #fff; color: #111827; font-family: inherit;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  input:focus, select:focus {
    outline: none; border-color: #1c3f8a; box-shadow: 0 0 0 3px rgba(28,63,138,0.12);
  }
  input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; }
  .small { padding: 5px 11px; font-size: 12px; border-radius: 7px; }

  /* ── Notes ── */
  .notes-row { display: flex; gap: 8px; align-items: flex-start; }
  .notes-row textarea {
    flex: 1; padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px;
    font-size: 13px; font-family: inherit; resize: none; min-height: 50px;
    color: #111827; background: #fff; line-height: 1.4;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .notes-row textarea:focus {
    outline: none; border-color: #1c3f8a; box-shadow: 0 0 0 3px rgba(28,63,138,0.12);
  }
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

  /* Generic button fallback */
  button {
    padding: 8px 14px; border: 1.5px solid #e5e7eb; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 13px; font-weight: 600;
    color: #374151; font-family: inherit; transition: all 0.12s;
  }
  button:hover { background: #f9fafb; }
  button:disabled { opacity: 0.35; cursor: not-allowed; }

  /* ── Match setup (collapsible) ── */
  .setup-details { margin-top: 18px; border-top: 1px solid #f0f2f0; padding-top: 12px; }
  .setup-details summary {
    cursor: pointer; font-size: 10px; font-weight: 800; color: #9ca3af;
    list-style: none; display: flex; align-items: center; gap: 8px; padding: 4px 0;
    text-transform: uppercase; letter-spacing: 0.08em; user-select: none;
  }
  .setup-details summary::-webkit-details-marker { display: none; }
  .setup-details summary::before { content: '▶'; font-size: 7px; transition: transform 0.2s; color: #c4c9c4; }
  .setup-details[open] summary::before { transform: rotate(90deg); }
  .setup-summary { font-weight: 400; color: #b0b5b0; font-size: 11px; text-transform: none; letter-spacing: 0; }
  .setup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding-top: 10px; }
  .full-row { grid-column: 1 / -1; }
  .setup-grid label { font-size: 12px; font-weight: 500; flex-direction: column; align-items: flex-start; gap: 3px; color: #6b7280; }
  .setup-grid input, .setup-grid select { width: 100%; font-size: 13px; padding: 7px 9px; }

  @media (max-width: 480px) {
    .setup-grid { grid-template-columns: 1fr; }
    .outcome-grid { grid-template-columns: repeat(3, 1fr); }
    .form-content { padding: 12px 14px 16px; }
  }
</style>
