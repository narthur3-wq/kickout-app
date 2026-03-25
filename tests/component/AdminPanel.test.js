import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

import AdminPanel from '../../src/lib/AdminPanel.svelte';

describe('AdminPanel', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('validates the password flow before calling the function', async () => {
    const user = userEvent.setup();

    render(AdminPanel, {
      props: {
        user: { email: 'admin@example.com' },
        teamName: 'Clontarf',
      },
    });

    await user.type(screen.getByPlaceholderText('analyst@example.com'), 'analyst@example.com');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'short');
    await user.click(screen.getByRole('button', { name: /Onboard user/i }));

    expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('shows the existing-user note when the backend reports that only the assignment changed', async () => {
    const user = userEvent.setup();
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        email: 'analyst@example.com',
        team: { name: 'Clontarf', created: false },
        auth: { delivery: 'password', existing: true, invited: false },
      },
      error: null,
    });

    render(AdminPanel, {
      props: {
        user: { email: 'admin@example.com' },
        teamName: 'Clontarf',
      },
    });

    await user.type(screen.getByPlaceholderText('analyst@example.com'), 'analyst@example.com');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'temporary123');
    await user.click(screen.getByRole('button', { name: /Onboard user/i }));

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Sign-in account already existed/i)).toBeInTheDocument();
  });

  it('keeps invite delivery tucked behind the advanced toggle', async () => {
    const user = userEvent.setup();

    render(AdminPanel, {
      props: {
        user: { email: 'admin@example.com' },
        teamName: 'Clontarf',
      },
    });

    expect(screen.queryByRole('button', { name: 'Email invite' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show advanced email invite option/i }));

    expect(screen.getByRole('button', { name: 'Email invite' })).toBeInTheDocument();
  });
});
