<script>
  import { supabase } from './supabase.js';

  export let user = null;
  export let teamName = null;

  let email = '';
  let teamMode = 'current'; // 'current' | 'named'
  let authMode = 'password'; // 'password' | 'invite'
  let newTeamName = '';
  let password = '';
  let loading = false;
  let result = null;
  let error = '';

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
    } finally {
      loading = false;
    }
  }
</script>

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
          Send invite email
        </button>
      </div>
    </div>

    {#if authMode === 'password'}
      <label class="full">
        <span>Temporary password</span>
        <input
          type="text"
          bind:value={password}
          placeholder="Minimum 8 characters"
          autocomplete="new-password"
        />
      </label>
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
        <div class="credential-note">Sign-in account already existed, so only the club assignment was updated.</div>
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
    <p><strong>Invite flow:</strong> keep this only if you later configure email properly in Supabase.</p>
    <p><strong>Note:</strong> if the auth account already exists, the app will just update the allowlist and team assignment.</p>
  </div>
</section>

<style>
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
  .mode-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
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
</style>
