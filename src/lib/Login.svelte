<script>
  import { createEventDispatcher } from 'svelte'
  import { supabase, userHasAccess } from './supabase.js'

  export let recoveryMode = false

  const dispatch = createEventDispatcher()
  const accessDeniedMessage = 'This account has not been granted beta access. Ask an admin to add this email through the Admin onboarding flow or into `allowed_users`.'

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
    return err?.message || fallback
  }

  async function signIn() {
    error = ''
    info = ''
    loading = true

    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

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
        error = accessDeniedMessage
        return
      }

      dispatch('login', data.session)
    } catch (err) {
      error = getAuthErrorMessage(err, 'Sign-in failed. Check your connection and try again.')
    } finally {
      loading = false
    }
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

  function handleKey(event) {
    if (event.key !== 'Enter') return
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

    <div class="form-body">
      {#if mode === 'updatePassword'}
        <p class="mode-note">Set a password for your account on this device.</p>
        <div class="field">
          <label class="field-label" for="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            placeholder="New password"
            bind:value={nextPassword}
            on:keydown={handleKey}
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
            on:keydown={handleKey}
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
            on:keydown={handleKey}
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
            on:keydown={handleKey}
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
        <button class="primary" on:click={updatePassword} disabled={loading || !nextPassword || !confirmPassword}>
          {loading ? 'Updating...' : 'Set password'}
        </button>
      {:else}
        <button class="primary" on:click={signIn} disabled={loading || !email || !password}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <button class="secondary" on:click={sendResetLink} disabled={loading || !email}>
          Send password reset email
        </button>
        <p class="invite-note">Access is admin-managed. Have an admin onboard the account first; a Supabase Auth user alone will not pass login.</p>
      {/if}
    </div>
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
    outline: none;
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
