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

  it('sends a password reset link and shows the confirmation message', async () => {
    const user = userEvent.setup();
    mockState.resetPasswordForEmailMock.mockResolvedValue({ error: null });

    render(Login);

    await user.type(screen.getByLabelText('Email'), 'analyst@example.com');
    await user.click(screen.getByRole('button', { name: /Send password reset email/i }));

    expect(mockState.resetPasswordForEmailMock).toHaveBeenCalled();
    expect(screen.getByText(/Password reset email sent/i)).toBeInTheDocument();
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
});
