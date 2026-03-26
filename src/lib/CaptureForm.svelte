<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let eventType = 'kickout';
  export let direction = 'ours';

  export let contest = 'clean';
  export let outcome = 'Retained';
  export let breakOutcome = '';
  export let targetPlayer = '';
  export let turnoverLostPlayer = '';
  export let turnoverWonPlayer = '';
  export let flagEvent = false;

  export let team = '';
  export let opponent = '';
  export let turnoverLostTeam = '';
  export let turnoverWonTeam = '';

  export let landingSet = false;
  export let pickupSet = false;
  export let period = 'H1';

  export let CONTESTS = [];
  export let BREAK_OUTS = [];
  export let editingId = null;
  export let undoStack = [];

  export let restartReason = '';
  const RESTART_REASONS = ['Score', 'Wide', 'Foul', 'Out'];

  export let shotType = 'point';
  export let savedFlash = false;

  export let onSave = () => {};
  export let onClearPoints = () => {};
  export let onUndoLast = () => {};

  const OUTCOME_MAP = {
    'kickout-ours': ['Retained', 'Lost'],
    'kickout-theirs': ['Won', 'Lost'],
    'turnover-ours': ['Won', 'Lost'],
    'turnover-theirs': ['Won', 'Lost'],
    'shot-ours': ['Goal', 'Point', 'Wide', 'Blocked', 'Saved'],
    'shot-theirs': ['Goal', 'Point', 'Wide', 'Blocked', 'Saved'],
  };

  const EVENT_TYPES = ['kickout', 'turnover', 'shot'];
  const JERSEY_NUMS = Array.from({ length: 15 }, (_, index) => index + 1);

  $: activeOutcomes = OUTCOME_MAP[`${eventType}-${direction}`] || ['Retained'];

  $: if (activeOutcomes.length > 0 && !activeOutcomes.includes(outcome)) {
    outcome = activeOutcomes[0];
  }

  $: if (outcome !== 'Wide' && outcome !== 'Blocked') {
    shotType = 'point';
  }

  function toggleJersey(num) {
    targetPlayer = targetPlayer === String(num) ? '' : String(num);
  }

  function outcomeClass(value) {
    return `outcome-${String(value || '').toLowerCase().replace(/\s+/g, '-')}`;
  }
</script>

<div class="form-content">
  <div class="field-label">Type</div>
  <div class="metric-row">
    {#each EVENT_TYPES as typeKey (typeKey)}
      <button
        type="button"
        class="seg-top {eventType === typeKey ? 'active' : ''}"
        on:click={() => (eventType = typeKey)}
      >
        {typeKey}
      </button>
    {/each}
  </div>

  <div class="field-label">Team</div>
  <p class="field-helper">Choose the team for this event.</p>
  <div class="dir-row">
    <button
      type="button"
      class="seg-dir {direction === 'ours' ? 'active' : ''}"
      on:click={() => (direction = 'ours')}
    >
      {team || 'Ours'}
    </button>
    <button
      type="button"
      class="seg-dir {direction === 'theirs' ? 'active' : ''}"
      on:click={() => (direction = 'theirs')}
    >
      {opponent || 'Theirs'}
    </button>
  </div>

  <div class="field-label">Period</div>
  <div class="dir-row">
    {#each ['H1', 'H2', 'ET'] as phase (phase)}
      <button
        type="button"
        class="seg-dir {period === phase ? 'active' : ''}"
        on:click={() => dispatch('periodChange', phase)}
      >
        {phase}
      </button>
    {/each}
  </div>

  {#if eventType === 'kickout'}
    <div class="field-label">Contest</div>
    <div class="btn-group">
      {#each CONTESTS as option (option)}
        <button
          type="button"
          class="seg-btn {contest === option ? 'active' : ''}"
          on:click={() => {
            contest = option;
            if (option !== 'break') breakOutcome = '';
          }}
        >
          {option}
        </button>
      {/each}
    </div>
    {#if contest === 'break'}
      <p class="break-hint {!landingSet ? 'break-hint-step' : !pickupSet ? 'break-hint-step2' : 'break-hint-done'}">
        {#if !landingSet}
          Step 1 - mark the landing point, then the pickup.
        {:else if !pickupSet}
          Landing marked - now tap the pickup point.
        {:else}
          Landing and pickup recorded.
        {/if}
      </p>
    {/if}
  {/if}

  <div class="field-label">Outcome</div>
  <div class="btn-group outcome-grid">
    {#each activeOutcomes as option (option)}
      <button
        type="button"
        class="seg-btn {outcome === option ? `active ${outcomeClass(option)}` : ''}"
        on:click={() => (outcome = option)}
      >
        {option}
      </button>
    {/each}
  </div>

  {#if eventType === 'shot' && (outcome === 'Wide' || outcome === 'Blocked')}
    <div class="shot-type-row">
      <span class="shot-type-label">Goal attempt?</span>
      <div class="shot-type-toggle">
        <button
          type="button"
          class="stt-btn {shotType === 'point' ? 'stt-active' : ''}"
          on:click={() => (shotType = 'point')}
        >
          No
        </button>
        <button
          type="button"
          class="stt-btn {shotType === 'goal' ? 'stt-active' : ''}"
          on:click={() => (shotType = 'goal')}
        >
          Yes
        </button>
      </div>
    </div>
  {/if}

  {#if eventType === 'kickout' && contest === 'break'}
    <div class="field-label">Who won the break?</div>
    <div class="btn-group">
      {#each BREAK_OUTS as option (option)}
        <button
          type="button"
          class="seg-btn {breakOutcome === option ? 'active' : ''}"
          on:click={() => (breakOutcome = option)}
        >
          {option}
        </button>
      {/each}
    </div>
  {/if}

  {#if eventType === 'kickout'}
    <div class="field-label">Restart after</div>
    <div class="btn-group">
      {#each RESTART_REASONS as reason (reason)}
        <button
          type="button"
          class="seg-btn {restartReason === reason ? 'active' : ''}"
          on:click={() => (restartReason = restartReason === reason ? '' : reason)}
        >
          {reason}
        </button>
      {/each}
    </div>
  {/if}

  {#if eventType === 'turnover'}
    <div class="field-label">Turnover players</div>
    <p class="field-helper">Record who lost the ball and who won it.</p>
    <div class="turnover-player-grid">
      <label class="turnover-player-field">
        <span class="turnover-player-label">
          Lost by{turnoverLostTeam ? ` (${turnoverLostTeam})` : ''}
        </span>
        <input
          class="turnover-player-input"
          type="number"
          min="1"
          max="99"
          inputmode="numeric"
          placeholder="e.g. 2"
          value={turnoverLostPlayer}
          on:input={(event) => (turnoverLostPlayer = event.currentTarget.value || '')}
        />
      </label>
      <label class="turnover-player-field">
        <span class="turnover-player-label">
          Won by{turnoverWonTeam ? ` (${turnoverWonTeam})` : ''}
        </span>
        <input
          class="turnover-player-input"
          type="number"
          min="1"
          max="99"
          inputmode="numeric"
          placeholder="e.g. 14"
          value={turnoverWonPlayer}
          on:input={(event) => (turnoverWonPlayer = event.currentTarget.value || '')}
        />
      </label>
    </div>
  {:else}
    <div class="field-label">Target player {targetPlayer ? `- #${targetPlayer}` : ''}</div>
    <div class="jersey-grid">
      {#each JERSEY_NUMS as num (num)}
        <button
          type="button"
          class="jersey-btn {targetPlayer === String(num) ? 'active' : ''}"
          on:click={() => toggleJersey(num)}
        >
          {num}
        </button>
      {/each}
    </div>
    <div class="jersey-custom-row">
      <span class="jersey-custom-label">Other #</span>
      <input
        class="jersey-custom-input"
        type="number"
        min="1"
        max="99"
        placeholder="16+"
        inputmode="numeric"
        value={targetPlayer && parseInt(targetPlayer, 10) > 15 ? targetPlayer : ''}
        on:input={(event) => (targetPlayer = event.currentTarget.value || '')}
      />
      {#if targetPlayer}
        <button type="button" class="jersey-clear" on:click={() => (targetPlayer = '')}>Clear</button>
      {/if}
    </div>
  {/if}

  {#if editingId}
    <div class="edit-badge">Editing event - tap Update when done</div>
  {/if}

  <div class="action-row">
    <button type="button" class="save-cta {savedFlash ? 'save-flash' : editingId ? 'save-edit' : ''}" on:click={onSave}>
      {savedFlash ? 'Saved!' : editingId ? 'Update Event' : 'Save Event'}
    </button>
    <div class="sec-row">
      <button type="button" class="sec-btn" on:click={onClearPoints}>Clear points</button>
      {#if editingId}
        <button type="button" class="sec-btn" on:click={() => dispatch('cancelEdit')}>Cancel</button>
      {/if}
      <button
        type="button"
        class="sec-btn"
        on:click={onUndoLast}
        disabled={undoStack.length === 0}
        title="Undo last change"
      >
        Undo last change
      </button>
      <label class="flag-inline" title="Flag for review">
        <input type="checkbox" bind:checked={flagEvent} />
        Flag
      </label>
    </div>
  </div>
</div>

<style>
  .form-content {
    display: flex;
    flex-direction: column;
    padding: 14px 16px 20px;
  }

  .field-label,
  .turnover-player-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
    margin: 16px 0 7px;
  }

  .field-helper {
    margin: -2px 0 8px;
    font-size: 12px;
    color: #64748b;
    line-height: 1.4;
  }

  .metric-row,
  .dir-row {
    display: flex;
    gap: 2px;
    background: #f3f4f6;
    border-radius: 9px;
    padding: 3px;
  }

  .seg-top,
  .seg-dir {
    flex: 1;
    padding: 8px 4px;
    font-size: 13px;
    font-weight: 700;
    border: none;
    border-radius: 7px;
    background: transparent;
    cursor: pointer;
    color: #6b7280;
    font-family: inherit;
    transition: all 0.15s;
  }

  .seg-top {
    text-transform: capitalize;
  }

  .seg-dir {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 50%;
  }

  .seg-top.active,
  .seg-dir.active {
    background: #fff;
    color: #1c3f8a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 0 0 0.5px rgba(0, 0, 0, 0.05);
  }

  .seg-top:active,
  .seg-dir:active,
  .seg-btn:active,
  .jersey-btn:active,
  .stt-btn:active {
    transform: scale(0.97);
  }

  .break-hint {
    font-size: 12px;
    font-weight: 600;
    margin: 4px 0 0;
    padding: 6px 8px;
    border-radius: 6px;
    line-height: 1.4;
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid transparent;
  }

  .break-hint-step {
    background: #eff6ff;
    color: #1d4ed8;
    border-color: #bfdbfe;
  }

  .break-hint-step2,
  .break-hint-done {
    background: #f0fdf4;
    color: #15803d;
    border-color: #bbf7d0;
  }

  .btn-group {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .outcome-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
  }

  .seg-btn {
    flex: 1;
    min-width: 52px;
    padding: 9px 6px;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    font-family: inherit;
    text-align: center;
    transition: all 0.12s;
  }

  .seg-btn:hover:not(.active),
  .jersey-btn:hover:not(.active),
  .sec-btn:hover:not(:disabled) {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  .seg-btn.active {
    background: #0a5;
    color: #fff;
    border-color: #0a5;
  }

  .seg-btn.active.outcome-lost {
    background: #dc2626;
    border-color: #dc2626;
  }

  .seg-btn.active.outcome-score {
    background: #2563eb;
    border-color: #2563eb;
  }

  .seg-btn.active.outcome-score-conceded {
    background: #dc2626;
    border-color: #dc2626;
  }

  .seg-btn.active.outcome-won {
    background: #16a34a;
    border-color: #16a34a;
  }

  .seg-btn.active.outcome-goal {
    background: #7c3aed;
    border-color: #7c3aed;
  }

  .seg-btn.active.outcome-point {
    background: #0891b2;
    border-color: #0891b2;
  }

  .seg-btn.active.outcome-wide {
    background: #d97706;
    border-color: #d97706;
  }

  .seg-btn.active.outcome-blocked {
    background: #b45309;
    border-color: #b45309;
  }

  .seg-btn.active.outcome-saved {
    background: #6b7280;
    border-color: #6b7280;
  }

  .seg-btn.active.outcome-foul {
    background: #db2777;
    border-color: #db2777;
  }

  .seg-btn.active.outcome-out {
    background: #7c3aed;
    border-color: #7c3aed;
  }

  .shot-type-row {
    margin-top: 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .shot-type-label {
    font-size: 12px;
    font-weight: 700;
    color: #475569;
  }

  .shot-type-toggle {
    display: inline-flex;
    gap: 2px;
    background: #f3f4f6;
    border-radius: 8px;
    padding: 2px;
  }

  .stt-btn {
    border: none;
    background: transparent;
    color: #64748b;
    font-weight: 700;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
  }

  .stt-btn.stt-active {
    background: #fff;
    color: #1c3f8a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .turnover-player-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .turnover-player-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .turnover-player-label {
    margin: 0;
  }

  .turnover-player-input,
  .jersey-custom-input,
  input {
    padding: 8px 10px;
    border: 1.5px solid #e5e7eb;
    border-radius: 7px;
    font-size: 14px;
    background: #fff;
    color: #111827;
    font-family: inherit;
    transition: border-color 0.12s, box-shadow 0.12s;
  }

  .turnover-player-input:focus,
  .jersey-custom-input:focus,
  input:focus {
    outline: none;
    border-color: #1c3f8a;
    box-shadow: 0 0 0 3px rgba(28, 63, 138, 0.12);
  }

  .jersey-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 4px;
  }

  .jersey-btn {
    padding: 7px 2px;
    font-size: 12px;
    font-weight: 700;
    text-align: center;
    border: 1.5px solid #e5e7eb;
    border-radius: 7px;
    background: #fff;
    cursor: pointer;
    color: #374151;
    font-family: inherit;
    transition: all 0.12s;
  }

  .jersey-btn.active {
    background: #7c3aed;
    color: #fff;
    border-color: #7c3aed;
  }

  .jersey-custom-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
  }

  .jersey-custom-label {
    font-size: 11px;
    font-weight: 700;
    color: #9ca3af;
    flex-shrink: 0;
  }

  .jersey-custom-input {
    width: 88px;
  }

  .jersey-clear {
    padding: 6px 8px;
    border: 1.5px solid #fca5a5;
    border-radius: 7px;
    background: #fff;
    cursor: pointer;
    font-size: 11px;
    color: #dc2626;
    font-family: inherit;
    transition: all 0.12s;
  }

  .jersey-clear:hover {
    background: #fef2f2;
  }

  .action-row {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 18px;
  }

  .save-cta {
    width: 100%;
    padding: 15px;
    background: #1c3f8a;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 800;
    cursor: pointer;
    font-family: inherit;
    letter-spacing: 0.01em;
    transition: background 0.2s, transform 0.1s;
    text-align: center;
  }

  .save-cta:hover {
    background: #163270;
  }

  .save-cta:active {
    transform: scale(0.99);
  }

  .save-cta.save-flash {
    background: #16a34a;
    cursor: default;
  }

  .save-cta.save-edit {
    background: #b45309;
  }

  .save-cta.save-edit:hover:not(.save-flash) {
    background: #92400e;
  }

  .edit-badge {
    background: #fef3c7;
    border: 1px solid #fde68a;
    border-radius: 7px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 8px;
    text-align: center;
  }

  .sec-row {
    display: flex;
    gap: 6px;
  }

  .sec-btn {
    flex: 1;
    padding: 9px 10px;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    background: #fff;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    color: #374151;
    font-family: inherit;
    text-align: center;
    transition: all 0.12s;
  }

  .sec-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .flag-inline {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #9ca3af;
    cursor: pointer;
    padding: 0 4px;
    white-space: nowrap;
  }

  .flag-inline input[type='checkbox'] {
    width: 15px;
    height: 15px;
    accent-color: #f59e0b;
    cursor: pointer;
  }

  @media (max-width: 640px) {
    .turnover-player-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (min-width: 768px) and (max-height: 940px) {
    .form-content {
      padding: 12px 14px 16px;
    }

    .field-label,
    .turnover-player-label {
      margin: 12px 0 6px;
      font-size: 10px;
    }

    .field-helper {
      margin: -1px 0 6px;
      font-size: 11px;
    }

    .seg-top,
    .seg-dir {
      padding: 7px 4px;
      font-size: 12px;
    }

    .seg-btn,
    .sec-btn {
      padding: 8px 6px;
      font-size: 12px;
    }

    .jersey-grid {
      gap: 3px;
    }

    .jersey-btn {
      padding: 6px 0;
      font-size: 11px;
    }

    .turnover-player-grid {
      gap: 8px;
    }

    .turnover-player-input,
    .jersey-custom-input,
    input {
      padding: 7px 9px;
      font-size: 13px;
    }

    .action-row {
      position: sticky;
      bottom: 0;
      margin-top: 14px;
      padding-top: 10px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #fff 22%);
    }

    .save-cta {
      padding: 12px;
      font-size: 14px;
    }
  }
</style>
