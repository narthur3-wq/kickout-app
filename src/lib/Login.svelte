<script>
  import { createEventDispatcher } from 'svelte'
  import { supabase, userHasAccess, demoCredentials, demoLoginEnabled } from './supabase.js'

  export let recoveryMode = false

  const dispatch = createEventDispatcher()
  const accessDeniedMessage = 'This account has not been granted beta access. Ask an admin to add this email through the Admin onboarding flow or into `allowed_users`.'
  const demoUnavailableMessage = 'The demo account is not set up on this deployment yet. See documentation/demo-access.md.'
  const expiredLinkMessage = 'This reset link has expired or has already been used. Go back and request a new password reset email. Reset links must be opened on the same device and browser that requested them.'

  let email = ''
  let password = ''
  let nextPassword = ''
  let confirmPassword = ''
  let error = ''
  let info = ''
  let loading = false
  let mode = 'signIn'

  $: mode = recoveryMode ? 'updatePassword' : 'signIn'

  function getAuthErrorMessage(err, fallback) {
    if (err?.message === 'Failed to fetch' || err instanceof TypeError) {
      return 'Could not reach the configured Supabase project. Check the app network connection and Supabase URL, then try again.'
    }
    // Supabase raises "Auth session missing!" when the recovery token in the
    // link could not be exchanged — expired, already used, or opened in a
    // different browser than the one that requested it.
    if (/auth session missing/i.test(err?.message || '')) {
      return expiredLinkMessage
    }
    return err?.message || fallback
  }

  async function signInWith(credentials, { deniedMessage = accessDeniedMessage } = {}) {
    error = ''
    info = ''
    loading = true

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword(credentials)

      if (err) {
        error = err.message
        return
      }

      const allowed = await userHasAccess()
      if (!allowed) {
        try {
          await supabase.auth.signOut()
        } catch {
          // Keep the allowlist error instead of masking it with cleanup noise.
        }
        error = deniedMessage
        return
      }

      dispatch('login', data.session)
    } catch (err) {
      error = getAuthErrorMessage(err, 'Sign-in failed. Check your connection and try again.')
    } finally {
      loading = false
    }
  }

  async function signIn() {
    await signInWith({ email: email.trim(), password })
  }

  // The demo account is a normal Supabase user on its own team, so it goes
  // through the same allowlist gate as everyone else. Only the credential
  // source and the failure message differ.
  async function signInAsDemo() {
    if (!demoCredentials) return
    await signInWith(demoCredentials, { deniedMessage: demoUnavailableMessage })
  }

  async function sendResetLink() {
    if (!email.trim()) {
      error = 'Enter your email first.'
      return
    }

    error = ''
    info = ''
    loading = true

    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      })

      if (err) {
        error = err.message
        return
      }

      info = 'Password reset email sent. Open it on this device to set a new password.'
    } catch (err) {
      error = getAuthErrorMessage(err, 'Could not send the reset email. Check your connection and try again.')
    } finally {
      loading = false
    }
  }

  async function updatePassword() {
    if (nextPassword.length < 8) {
      error = 'Password must be at least 8 characters.'
      return
    }

    if (nextPassword !== confirmPassword) {
      error = 'Passwords do not match.'
      return
    }

    error = ''
    info = ''
    loading = true

    try {
      const { error: err } = await supabase.auth.updateUser({ password: nextPassword })
      if (err) {
        error = getAuthErrorMessage(err, 'Password update failed. Check your connection and try again.')
        return
      }

      const allowed = await userHasAccess()
      if (!allowed) {
        try {
          await supabase.auth.signOut()
        } catch {
          // Keep the allowlist error instead of masking it with cleanup noise.
        }
        error = accessDeniedMessage
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      info = 'Password updated. Signing you in...'
      dispatch('login', session)
    } catch (err) {
      error = getAuthErrorMessage(err, 'Password update failed. Check your connection and try again.')
    } finally {
      loading = false
    }
  }

  // Strips the spent token from the URL and drops back to the sign-in form.
  // Reloading is the simplest way to reset the shell's recovery state without
  // threading another event back up through App.
  function leaveRecoveryMode() {
    try {
      window.history.replaceState(null, '', window.location.pathname)
    } catch {
      // Fall through to the reload regardless.
    }
    window.location.reload()
  }

  function submitCurrentMode() {
    if (mode === 'updatePassword') updatePassword()
    else signIn()
  }
</script>

<div class="login-wrap">
  <div class="login-card">
    <div class="brand-header">
      <div class="red-stripe"></div>
      <div class="brand-inner">
        <img src="/crest.png" class="brand-crest" alt="Clontarf GAA" />
        <div class="brand-text">
          <div class="brand-title">P&aacute;irc</div>
          <div class="brand-sub">GAA Match Analyst</div>
        </div>
      </div>
    </div>

    <form class="form-body" on:submit|preventDefault={submitCurrentMode}>
      {#if mode === 'updatePassword'}
        <p class="mode-note">Set a password for your account on this device.</p>
        <div class="field">
          <label class="field-label" for="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            placeholder="New password"
            bind:value={nextPassword}
            autocomplete="new-password"
          />
        </div>
        <div class="field">
          <label class="field-label" for="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            placeholder="Confirm new password"
            bind:value={confirmPassword}
            autocomplete="new-password"
          />
        </div>
      {:else}
        <div class="field">
          <label class="field-label" for="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            bind:value={email}
            autocomplete="email"
          />
        </div>
        <div class="field">
          <label class="field-label" for="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Password"
            bind:value={password}
            autocomplete="current-password"
          />
        </div>
      {/if}

      {#if error}
        <p class="error" role="alert">{error}</p>
      {/if}

      {#if info}
        <p class="info" aria-live="polite">{info}</p>
      {/if}

      {#if mode === 'updatePassword'}
        <button type="submit" class="primary" disabled={loading || !nextPassword || !confirmPassword}>
          {loading ? 'Updating...' : 'Set password'}
        </button>
        <!-- Without this a spent or expired link is a dead end: the set-password
             form is the only thing on screen and it can never succeed. -->
        <button type="button" class="secondary" on:click={leaveRecoveryMode} disabled={loading}>
          Back to sign in
        </button>
      {:else}
        <button type="submit" class="primary" disabled={loading || !email || !password}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <button type="button" class="secondary" on:click={sendResetLink} disabled={loading || !email}>
          Send password reset email
        </button>
        {#if demoLoginEnabled}
          <div class="divider"><span>or</span></div>
          <button type="button" class="demo" on:click={signInAsDemo} disabled={loading}>
            {loading ? 'Opening demo...' : 'Explore the demo'}
          </button>
          <p class="demo-note">Opens a sample match with no sign-up. Demo data is shared and separate from any club's real data.</p>
        {/if}
        <p class="invite-note">Access is admin-managed. Have an admin onboard the account first; a Supabase Auth user alone will not pass login.</p>
      {/if}
    </form>
  </div>
</div>

<style>
  .login-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100svh;
    background: #f1f5f9;
  }

  .login-card {
    width: 100%;
    max-width: 360px;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .brand-header {
    background: #0f1923;
    display: flex;
    flex-direction: column;
  }

  .red-stripe {
    height: 3px;
    background: #c41230;
  }

  .brand-inner {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 24px 24px 22px;
  }

  .brand-crest {
    width: 52px;
    height: 52px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .brand-title {
    font-size: 26px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .brand-sub {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 3px;
  }

  .form-body {
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 24px 24px 28px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field-label {
    font-size: 12px;
    font-weight: 700;
    color: #334155;
  }

  input {
    padding: 11px 13px;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    font-size: 15px;
    width: 100%;
    box-sizing: border-box;
    background: #f8fafc;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  input:focus {
    border-color: #1c3f8a;
    box-shadow: 0 0 0 3px rgba(28, 63, 138, 0.12);
    background: #fff;
  }

  .error {
    color: #dc2626;
    font-size: 13px;
    margin: 0;
    background: #fef2f2;
    border-radius: 6px;
    padding: 8px 10px;
  }

  .info {
    color: #1d4ed8;
    font-size: 13px;
    margin: 0;
    background: #eff6ff;
    border-radius: 6px;
    padding: 8px 10px;
  }

  .mode-note {
    margin: 0 0 2px;
    font-size: 13px;
    color: #475569;
  }

  button {
    width: 100%;
    padding: 12px;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s, opacity 0.15s;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .primary {
    background: #1c3f8a;
    color: #fff;
    border: none;
    margin-top: 4px;
  }

  .primary:hover:not(:disabled) {
    background: #163270;
  }

  .secondary {
    background: #eef2ff;
    color: #1c3f8a;
    border: 1px solid #c7d2fe;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 6px 0 2px;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #e2e8f0;
  }

  .demo {
    background: #fff;
    color: #0f1923;
    border: 1.5px solid #0f1923;
  }

  .demo:hover:not(:disabled) {
    background: #0f1923;
    color: #fff;
  }

  .demo-note {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: #475569;
    text-align: center;
  }

  .secondary:hover:not(:disabled) {
    background: #e0e7ff;
  }

  .invite-note {
    text-align: center;
    font-size: 12px;
    color: #94a3b8;
    margin: 4px 0 0;
    padding: 0;
  }
</style>
