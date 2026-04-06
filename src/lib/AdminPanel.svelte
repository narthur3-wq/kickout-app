<script>
  import { createEventDispatcher } from 'svelte';
  import { supabase } from './supabase.js';
  import { appendDiagnostic } from './diagnostics.js';
  import { displayPlayerLabel, normalizePlayerKey } from './postMatchAnalysis.js';
  import { createEmptyAnalysisState, loadAnalysisState, saveAnalysisState } from './postMatchAnalysisStore.js';

  export let user = null;
  export let teamName = null;
  export let storageScope = null;
  export let analysisRefreshToken = 0;

  const dispatch = createEventDispatcher();

  let email = '';
  let teamMode = 'current'; // 'current' | 'named'
  let authMode = 'password'; // 'password' | 'invite'
  let newTeamName = '';
  let password = '';
  let showPassword = false;
  let showAdvancedDelivery = false;
  let loading = false;
  let result = null;
  let error = '';
  let analysisState = createEmptyAnalysisState();
  let loadedScope = null;
  let loadedAnalysisRefreshToken = null;
  let rosterDraftName = '';
  let rosterNotice = '';
  let rosterNoticeType = 'success';
  let rosterEditNames = {};

  function loadScope(scope) {
    if (!scope) {
      analysisState = createEmptyAnalysisState();
      loadedScope = null;
      return;
    }
    analysisState = loadAnalysisState(scope);
    loadedScope = scope;
  }

  function saveRoster(nextPlayers) {
    const nextState = {
      ...analysisState,
      squadPlayers: nextPlayers,
    };
    analysisState = nextState;
    if (storageScope) saveAnalysisState(nextState, storageScope);
    dispatch('rosterchange');
  }

  function setRosterNotice(type, message) {
    rosterNoticeType = type;
    rosterNotice = message;
  }

  function normalizedRosterKey(value) {
    return normalizePlayerKey(displayPlayerLabel(value));
  }

  function rosterHasName(name, ignoreId = null) {
    const key = normalizedRosterKey(name);
    if (!key) return false;
    return squadPlayers.some((player) => {
      if (ignoreId && player.id === ignoreId) return false;
      return normalizedRosterKey(player.name) === key;
    });
  }

  function addRosterPlayer() {
    const cleaned = displayPlayerLabel(rosterDraftName);
    if (!cleaned) {
      setRosterNotice('error', 'Enter a player name before adding.');
      return;
    }
    if (rosterHasName(cleaned)) {
      setRosterNotice('error', 'That player already exists in the roster.');
      return;
    }
    const timestamp = new Date().toISOString();
    const nextPlayers = [
      {
        id: crypto.randomUUID(),
        name: cleaned,
        active: true,
        created_at: timestamp,
        updated_at: timestamp,
      },
      ...squadPlayers,
    ];
    saveRoster(nextPlayers);
    rosterDraftName = '';
    setRosterNotice('success', 'Player added to the roster.');
  }

  function updatePlayerName(player, nextName) {
    const cleaned = displayPlayerLabel(nextName);
    if (!cleaned) {
      setRosterNotice('error', 'Player name cannot be empty.');
      return;
    }
    if (rosterHasName(cleaned, player.id)) {
      setRosterNotice('error', 'Another roster player already uses that name.');
      return;
    }
    const timestamp = new Date().toISOString();
    const nextPlayers = squadPlayers.map((item) => {
      if (item.id !== player.id) return item;
      return {
        ...item,
        name: cleaned,
        updated_at: timestamp,
      };
    });
    saveRoster(nextPlayers);
    rosterEditNames = { ...rosterEditNames, [player.id]: cleaned };
    setRosterNotice('success', 'Player name updated.');
  }

  function togglePlayerActive(player) {
    const timestamp = new Date().toISOString();
    const nextPlayers = squadPlayers.map((item) => {
      if (item.id !== player.id) return item;
      return {
        ...item,
        active: item.active === false,
        updated_at: timestamp,
      };
    });
    saveRoster(nextPlayers);
  }

  $: if (storageScope !== loadedScope) {
    loadScope(storageScope);
    rosterDraftName = '';
    rosterNotice = '';
    rosterEditNames = {};
  }

  $: if (storageScope && analysisRefreshToken !== loadedAnalysisRefreshToken) {
    loadScope(storageScope);
    loadedAnalysisRefreshToken = analysisRefreshToken;
  }

  $: squadPlayers = Array.isArray(analysisState?.squadPlayers)
    ? analysisState.squadPlayers
    : [];

  $: orderedSquadPlayers = [...squadPlayers].sort((a, b) => {
    const aInactive = Number(a.active === false);
    const bInactive = Number(b.active === false);
    if (aInactive !== bInactive) return aInactive - bInactive;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  async function onboardUser() {
    error = '';
    result = null;

    const cleanedEmail = email.trim().toLowerCase();
    const cleanedTeamName = newTeamName.trim();

    if (!cleanedEmail) {
      error = 'Enter an email address.';
      return;
    }

    if (teamMode === 'named' && !cleanedTeamName) {
      error = 'Enter a team name or use your current team.';
      return;
    }

    if (authMode === 'password' && password.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }

    loading = true;
    try {
      const payload = {
        email: cleanedEmail,
        teamName: teamMode === 'named' ? cleanedTeamName : null,
        delivery: authMode,
        password: authMode === 'password' ? password : null,
        redirectTo: authMode === 'invite' ? window.location.origin : null,
      };

      const { data, error: fnError } = await supabase.functions.invoke('onboard-user', {
        body: payload,
      });

      if (fnError) throw fnError;
      if (!data?.ok) throw new Error(data?.error || 'Onboarding failed.');

      result = data;
      email = '';
      password = '';
      if (teamMode === 'named') newTeamName = '';
    } catch (err) {
      error = err?.message || 'Onboarding failed.';
      appendDiagnostic({
        kind: 'onboarding',
        message: error,
        details: {
          email: cleanedEmail,
          teamMode,
          teamName: teamMode === 'named' ? cleanedTeamName : null,
          authMode,
        },
      });
      dispatch('diagnostic');
    } finally {
      loading = false;
    }
  }
</script>

<div class="admin-shell">
  <section class="card">
    <div class="panel-header">
      <div>
        <h2>Admin Onboarding</h2>
        <p class="sub">Create or reuse a club, then make the sign-in account and team assignment in one place.</p>
      </div>
    </div>

    <div class="status-grid">
      <div class="status-item">
        <span class="label">Signed in as</span>
        <span class="value mono">{user?.email || 'Unknown'}</span>
      </div>
      <div class="status-item">
        <span class="label">Current team</span>
        <span class="value">{teamName || 'No team assigned'}</span>
      </div>
    </div>

    <div class="form-grid">
      <label class="full">
        <span>User email</span>
        <input
          type="email"
          bind:value={email}
          placeholder="analyst@example.com"
          autocomplete="email"
        />
      </label>

      <div class="full">
        <span class="field-title">Sign-in setup</span>
        <div class="delivery-card">
          <div class="delivery-title">Set password now</div>
          <p class="delivery-copy">Best for this setup. Create the account here, then send the analyst the email and password directly.</p>
          <button
            class="advanced-link"
            type="button"
            on:click={() => {
              showAdvancedDelivery = !showAdvancedDelivery;
              if (!showAdvancedDelivery) authMode = 'password';
            }}
          >
            {showAdvancedDelivery ? 'Hide advanced email invite option' : 'Show advanced email invite option'}
          </button>
        </div>
      </div>

      {#if authMode === 'password'}
        <label class="full">
          <span>Temporary password</span>
          <div class="password-row">
            <input
              type={showPassword ? 'text' : 'password'}
              bind:value={password}
              placeholder="Minimum 8 characters"
              autocomplete="new-password"
            />
            <button class="toggle-password" type="button" on:click={() => showPassword = !showPassword}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <small class="field-note">If this email already has an account, this password will be ignored and only the club assignment will change.</small>
        </label>
      {/if}

      {#if showAdvancedDelivery}
        <div class="full advanced-panel">
          <span class="field-title">Advanced delivery</span>
          <div class="mode-row">
            <button
              class:active={authMode === 'password'}
              on:click={() => authMode = 'password'}
              type="button"
            >
              Set password now
            </button>
            <button
              class:active={authMode === 'invite'}
              on:click={() => authMode = 'invite'}
              type="button"
            >
              Email invite
            </button>
          </div>
          <p class="advanced-note">Only use email invite if you have email delivery properly configured in Supabase.</p>
        </div>
      {/if}

      <div class="full">
        <span class="field-title">Assign to</span>
        <div class="mode-row">
          <button
            class:active={teamMode === 'current'}
            on:click={() => teamMode = 'current'}
            type="button"
          >
            Your current team
          </button>
          <button
            class:active={teamMode === 'named'}
            on:click={() => teamMode = 'named'}
            type="button"
          >
            Create / find another team
          </button>
        </div>
      </div>

      {#if teamMode === 'named'}
        <label class="full">
          <span>Team name</span>
          <input
            type="text"
            bind:value={newTeamName}
            placeholder="Na Fianna GAA"
          />
        </label>
      {/if}
    </div>

    {#if error}
      <div class="notice error">{error}</div>
    {/if}

    {#if result}
      <div class="notice success">
        <strong>{result.email}</strong> assigned to <strong>{result.team.name}</strong>.
        {#if result.team.created}
          New team created.
        {:else}
          Existing team reused.
        {/if}
        {#if result.auth?.invited}
          <div class="credential-note">Invite email sent. They can open it and go straight into the app.</div>
        {:else if result.auth?.delivery === 'password' && !result.auth?.existing}
          <div class="credential-note">Account created. Give them this email and the password you entered above.</div>
        {:else if result.auth?.existing}
          <div class="credential-note">Sign-in account already existed, so only the club assignment was updated. Any temporary password entered here was not changed.</div>
        {/if}
      </div>
    {/if}

    <div class="actions">
      <button class="primary" on:click={onboardUser} disabled={loading}>
        {loading ? 'Saving user...' : 'Onboard user'}
      </button>
    </div>

    <div class="help">
      <p><strong>Same club:</strong> leave it on "Your current team" and just enter the email.</p>
      <p><strong>New club:</strong> choose "Create / find another team" and enter the club name.</p>
      <p><strong>Password flow:</strong> set a temporary password here, then send the analyst the email and password directly.</p>
      <p><strong>Invite flow:</strong> this is intentionally tucked away as an advanced option for later.</p>
      <p><strong>Note:</strong> if the auth account already exists, the app will just update the allowlist and team assignment.</p>
    </div>
  </section>

  <section class="card">
    <div class="panel-header">
      <div>
        <h2>Squad Roster</h2>
        <p class="sub">Manage the canonical player list used by post-match analysis and cross-match aggregation.</p>
      </div>
    </div>

    <div class="roster-controls">
      <label class="roster-field">
        <span>Player name</span>
        <input
          type="text"
          bind:value={rosterDraftName}
          placeholder="Add player name"
        />
      </label>
      <button class="primary" type="button" on:click={addRosterPlayer} disabled={!rosterDraftName.trim()}>
        Add player
      </button>
    </div>

    {#if rosterNotice}
      <div class="notice {rosterNoticeType}">{rosterNotice}</div>
    {/if}

    {#if orderedSquadPlayers.length === 0}
      <div class="empty-state">No roster entries yet. Add players to start the canonical list.</div>
    {:else}
      <div class="roster-list">
        {#each orderedSquadPlayers as player (player.id)}
          {@const draftName = rosterEditNames[player.id] ?? player.name}
          <div class="roster-row">
            <input
              class="roster-input"
              type="text"
              value={draftName}
              on:input={(e) => rosterEditNames = { ...rosterEditNames, [player.id]: e.currentTarget.value }}
            />
            <label class="roster-toggle">
              <input
                type="checkbox"
                checked={player.active !== false}
                on:change={() => togglePlayerActive(player)}
              />
              <span>{player.active === false ? 'Inactive' : 'Active'}</span>
            </label>
            <button
              type="button"
              class="ghost"
              on:click={() => updatePlayerName(player, draftName)}
              disabled={draftName.trim() === player.name}
            >
              Save
            </button>
          </div>
        {/each}
      </div>
      <p class="roster-note">Inactive players stay in history but are hidden from the default autocomplete.</p>
    {/if}
  </section>
</div>

<style>
  .admin-shell {
    display: grid;
    gap: 16px;
  }
  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px;
    max-width: 760px;
    margin: 0 auto;
  }
  .panel-header h2 {
    margin: 0;
    font-size: 20px;
    color: #111827;
  }
  .sub {
    margin: 6px 0 0;
    color: #6b7280;
    font-size: 14px;
  }
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
    margin-top: 18px;
  }
  .status-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 14px;
  }
  .label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #9ca3af;
    font-weight: 700;
  }
  .value {
    display: block;
    margin-top: 6px;
    color: #111827;
    font-weight: 600;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 13px;
    word-break: break-all;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
    margin-top: 18px;
  }
  .full {
    grid-column: 1 / -1;
  }
  label span, .field-title {
    display: block;
    margin-bottom: 6px;
    font-size: 12px;
    color: #374151;
    font-weight: 700;
  }
  input {
    width: 100%;
    padding: 11px 12px;
    border-radius: 9px;
    border: 1.5px solid #d1d5db;
    font-size: 14px;
    box-sizing: border-box;
    font-family: inherit;
  }
  input:focus {
    outline: none;
    border-color: #1c3f8a;
    box-shadow: 0 0 0 3px rgba(28,63,138,0.12);
  }
  .delivery-card,
  .advanced-panel {
    border: 1px solid #dbe5f4;
    background: #f8fbff;
    border-radius: 10px;
    padding: 12px 14px;
  }
  .delivery-title {
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }
  .delivery-copy,
  .advanced-note,
  .field-note {
    margin: 6px 0 0;
    font-size: 12px;
    color: #6b7280;
  }
  .advanced-link {
    margin-top: 10px;
    border: none;
    background: none;
    padding: 0;
    color: #1c3f8a;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }
  .mode-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .password-row {
    display: flex;
    gap: 8px;
  }
  .password-row input {
    flex: 1;
  }
  .toggle-password {
    padding: 0 12px;
    border-radius: 9px;
    border: 1.5px solid #d1d5db;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: #4b5563;
  }
  .mode-row button {
    padding: 10px 12px;
    border-radius: 9px;
    border: 1.5px solid #d1d5db;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 700;
    color: #4b5563;
  }
  .mode-row button.active {
    border-color: #1c3f8a;
    background: #eff6ff;
    color: #1c3f8a;
  }
  .notice {
    margin-top: 16px;
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    line-height: 1.5;
  }
  .notice.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #166534;
  }
  .notice.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
  }
  .actions {
    margin-top: 16px;
  }
  .credential-note {
    margin-top: 6px;
    font-size: 12px;
    color: #166534;
  }
  .primary {
    padding: 12px 18px;
    border: none;
    border-radius: 10px;
    background: #1c3f8a;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 800;
  }
  .primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .help {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
  }
  .help p {
    margin: 0 0 8px;
    color: #6b7280;
    font-size: 13px;
  }
  .roster-controls {
    margin-top: 14px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: end;
  }
  .roster-field {
    display: grid;
    gap: 6px;
  }
  .roster-field span {
    font-size: 12px;
    color: #374151;
    font-weight: 700;
  }
  .roster-list {
    margin-top: 16px;
    display: grid;
    gap: 10px;
  }
  .roster-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #e5e7eb;
    background: #f9fafb;
  }
  .roster-input {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 13px;
  }
  .roster-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #4b5563;
  }
  .roster-toggle input {
    width: 16px;
    height: 16px;
    accent-color: #1c3f8a;
  }
  .ghost {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #d1d5db;
    background: #fff;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .ghost:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .empty-state {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px dashed #d1d5db;
    color: #6b7280;
    font-size: 13px;
  }
  .roster-note {
    margin-top: 10px;
    color: #6b7280;
    font-size: 12px;
  }
  @media (max-width: 640px) {
    .roster-controls {
      grid-template-columns: 1fr;
    }
    .roster-row {
      grid-template-columns: 1fr;
      align-items: start;
    }
  }
</style>
