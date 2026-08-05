import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  signInWithPasswordMock: vi.fn(),
  resetPasswordForEmailMock: vi.fn(),
  updateUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  signOutMock: vi.fn(),
  userHasAccessMock: vi.fn(),
  // Mutable so a test can flip the deployment between demo-enabled and not.
  demoCredentials: null,
  demoLoginEnabled: false,
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithPassword: mockState.signInWithPasswordMock,
      resetPasswordForEmail: mockState.resetPasswordForEmailMock,
      updateUser: mockState.updateUserMock,
      getSession: mockState.getSessionMock,
      signOut: mockState.signOutMock,
    },
  },
  userHasAccess: mockState.userHasAccessMock,
  get demoCredentials() { return mockState.demoCredentials; },
  get demoLoginEnabled() { return mockState.demoLoginEnabled; },
}));

import Login from '../../src/lib/Login.svelte';

describe('Login', () => {
  beforeEach(() => {
    mockState.signInWithPasswordMock.mockReset();
    mockState.resetPasswordForEmailMock.mockReset();
    mockState.updateUserMock.mockReset();
    mockState.getSessionMock.mockReset();
    mockState.signOutMock.mockReset();
    mockState.userHasAccessMock.mockReset();
    mockState.userHasAccessMock.mockResolvedValue(true);
    mockState.getSessionMock.mockResolvedValue({ data: { session: { access_token: 'token' } } });
    mockState.demoCredentials = null;
    mockState.demoLoginEnabled = false;
  });

  it('dispatches login after a successful sign-in', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();

    mockState.signInWithPasswordMock.mockResolvedValue({
      data: { session: { user: { email: 'analyst@example.com' } } },
      error: null,
    });

    render(Login, { events: { login: onLogin } });

    await user.type(screen.getByLabelText('Email'), 'analyst@example.com');
    await user.type(screen.getByLabelText('Password'), 'temporary123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(mockState.signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'analyst@example.com',
      password: 'temporary123',
    });
    expect(onLogin).toHaveBeenCalled();
  });

  it('blocks sign-in when the account is not in the beta allowlist', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();

    mockState.signInWithPasswordMock.mockResolvedValue({
      data: { session: { user: { email: 'smoke@yourapp.com' } } },
      error: null,
    });
    mockState.userHasAccessMock.mockResolvedValue(false);

    render(Login, { events: { login: onLogin } });

    await user.type(screen.getByLabelText('Email'), 'smoke@yourapp.com');
    await user.type(screen.getByLabelText('Password'), 'temporary123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(mockState.signOutMock).toHaveBeenCalledTimes(1);
    expect(onLogin).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/allowed_users/i);
  });

  it('surfaces thrown sign-in failures and clears the loading state', async () => {
    const user = userEvent.setup();

    mockState.signInWithPasswordMock.mockRejectedValue(new Error('Lock acquisition stalled'));

    render(Login);

    await user.type(screen.getByLabelText('Email'), 'analyst@example.com');
    await user.type(screen.getByLabelText('Password'), 'temporary123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Lock acquisition stalled/i);
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeEnabled();
  });

  it('sends a password reset link and shows the confirmation message', async () => {
    const user = userEvent.setup();
    mockState.resetPasswordForEmailMock.mockResolvedValue({ error: null });

    render(Login);

    await user.type(screen.getByLabelText('Email'), 'analyst@example.com');
    await user.click(screen.getByRole('button', { name: /Send password reset email/i }));

    expect(mockState.resetPasswordForEmailMock).toHaveBeenCalled();
    expect(screen.getByText(/Password reset email sent/i)).toBeInTheDocument();
  });

  it('explains network reset failures when Supabase cannot be reached', async () => {
    const user = userEvent.setup();
    mockState.resetPasswordForEmailMock.mockRejectedValue(new TypeError('Failed to fetch'));

    render(Login);

    await user.type(screen.getByLabelText('Email'), 'analyst@example.com');
    await user.click(screen.getByRole('button', { name: /Send password reset email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Could not reach the configured Supabase project/i);
    expect(screen.getByRole('button', { name: /Send password reset email/i })).toBeEnabled();
  });

  it('shows a password mismatch error in recovery mode', async () => {
    const user = userEvent.setup();

    render(Login, { recoveryMode: true });

    await user.type(screen.getByLabelText('New password'), 'temporary123');
    await user.type(screen.getByLabelText('Confirm new password'), 'different123');
    await user.click(screen.getByRole('button', { name: /Set password/i }));

    expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    expect(mockState.updateUserMock).not.toHaveBeenCalled();
  });

  it('updates the password and dispatches login in recovery mode', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn();

    mockState.updateUserMock.mockResolvedValue({ error: null });

    render(Login, { props: { recoveryMode: true }, events: { login: onLogin } });

    await user.type(screen.getByLabelText('New password'), 'temporary123');
    await user.type(screen.getByLabelText('Confirm new password'), 'temporary123');
    await user.click(screen.getByRole('button', { name: /Set password/i }));

    expect(mockState.updateUserMock).toHaveBeenCalledWith({ password: 'temporary123' });
    expect(onLogin).toHaveBeenCalledWith(expect.objectContaining({ detail: { access_token: 'token' } }));
  });

  describe('expired recovery links', () => {
    it('explains a spent link instead of surfacing "Auth session missing!"', async () => {
      const user = userEvent.setup();
      // What Supabase returns when the recovery token cannot be exchanged —
      // expired, already used, or opened in a different browser.
      mockState.updateUserMock.mockResolvedValue({
        error: { message: 'Auth session missing!' },
      });

      render(Login, { recoveryMode: true });

      await user.type(screen.getByLabelText('New password'), 'temporary123');
      await user.type(screen.getByLabelText('Confirm new password'), 'temporary123');
      await user.click(screen.getByRole('button', { name: /Set password/i }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/expired or has already been used/i);
      expect(alert).not.toHaveTextContent(/Auth session missing/i);
    });

    it('offers a way out of recovery mode so a dead link is not a trap', () => {
      render(Login, { recoveryMode: true });

      expect(screen.getByRole('button', { name: /Back to sign in/i })).toBeEnabled();
    });
  });

  describe('demo access', () => {
    const demoCredentials = { email: 'demo@pairc.app', password: 'demo-pass' };

    it('hides the demo button when no demo account is configured', () => {
      render(Login);

      expect(screen.queryByRole('button', { name: /Explore the demo/i })).not.toBeInTheDocument();
    });

    it('signs in with the configured demo credentials without any typing', async () => {
      const user = userEvent.setup();
      const onLogin = vi.fn();
      mockState.demoCredentials = demoCredentials;
      mockState.demoLoginEnabled = true;
      mockState.signInWithPasswordMock.mockResolvedValue({
        data: { session: { user: { email: demoCredentials.email } } },
        error: null,
      });

      render(Login, { events: { login: onLogin } });
      await user.click(screen.getByRole('button', { name: /Explore the demo/i }));

      expect(mockState.signInWithPasswordMock).toHaveBeenCalledWith(demoCredentials);
      expect(onLogin).toHaveBeenCalled();
    });

    it('still enforces the allowlist for the demo account', async () => {
      const user = userEvent.setup();
      const onLogin = vi.fn();
      mockState.demoCredentials = demoCredentials;
      mockState.demoLoginEnabled = true;
      mockState.signInWithPasswordMock.mockResolvedValue({
        data: { session: { user: { email: demoCredentials.email } } },
        error: null,
      });
      mockState.userHasAccessMock.mockResolvedValue(false);

      render(Login, { events: { login: onLogin } });
      await user.click(screen.getByRole('button', { name: /Explore the demo/i }));

      expect(mockState.signOutMock).toHaveBeenCalledTimes(1);
      expect(onLogin).not.toHaveBeenCalled();
      // Demo failures point at the setup guide, not at the admin onboarding flow.
      expect(await screen.findByRole('alert')).toHaveTextContent(/demo account is not set up/i);
    });

    it('does not require email or password to be filled in', () => {
      mockState.demoCredentials = demoCredentials;
      mockState.demoLoginEnabled = true;

      render(Login);

      expect(screen.getByRole('button', { name: /Explore the demo/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /^Sign in$/i })).toBeDisabled();
    });
  });
});
