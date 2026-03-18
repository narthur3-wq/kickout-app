<script>
  import { supabase } from './supabase.js'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  let email = '', password = '', error = '', loading = false

  async function signIn() {
    error = ''; loading = true
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    loading = false
    if (err) { error = err.message; return }
    dispatch('login', data.session)
  }

  async function signUp() {
    error = ''; loading = true
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    loading = false
    if (err) { error = err.message; return }
    if (data.session) {
      dispatch('login', data.session)
    } else {
      error = 'Check your email to confirm your account, then sign in.'
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter') signIn()
  }
</script>

<div class="login-wrap">
  <div class="login-card">
    <h1>KickOut</h1>
    <p class="sub">GAA Kickout Analytics</p>

    <input
      type="email"
      placeholder="Email"
      bind:value={email}
      on:keydown={handleKey}
      autocomplete="email"
    />
    <input
      type="password"
      placeholder="Password"
      bind:value={password}
      on:keydown={handleKey}
      autocomplete="current-password"
    />

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="btn-row">
      <button class="primary" on:click={signIn} disabled={loading || !email || !password}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <button on:click={signUp} disabled={loading || !email || !password}>
        Sign up
      </button>
    </div>
  </div>
</div>

<style>
  .login-wrap {
    display: flex; align-items: center; justify-content: center;
    min-height: 100svh; background: #f4f7f4;
  }
  .login-card {
    background: #fff; border-radius: 12px; padding: 32px 28px;
    width: 100%; max-width: 360px; box-shadow: 0 2px 16px #0002;
    display: flex; flex-direction: column; gap: 12px;
  }
  h1 { font-size: 24px; font-weight: 700; margin: 0; color: #0a5; }
  .sub { font-size: 14px; color: #666; margin: -8px 0 4px; }
  input {
    padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px;
    font-size: 16px; width: 100%; box-sizing: border-box;
  }
  input:focus { outline: none; border-color: #0a5; box-shadow: 0 0 0 2px #0a52; }
  .error { color: #b33; font-size: 13px; margin: 0; }
  .btn-row { display: flex; gap: 8px; }
  button {
    flex: 1; padding: 10px; border: 1px solid #bbb; border-radius: 8px;
    background: #fff; cursor: pointer; font-size: 15px;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .primary { background: #0a5; color: #fff; border-color: #0a5; }
</style>
