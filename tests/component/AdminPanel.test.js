import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));
const { appendDiagnosticMock } = vi.hoisted(() => ({
  appendDiagnosticMock: vi.fn(),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabase: {
    functions: {
      invoke: invokeMock,
    },
  },
}));

vi.mock('../../src/lib/diagnostics.js', () => ({
  appendDiagnostic: appendDiagnosticMock,
}));

import AdminPanel from '../../src/lib/AdminPanel.svelte';

describe('AdminPanel', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    appendDiagnosticMock.mockReset();
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

  it('records onboarding failures in the diagnostics log', async () => {
    const user = userEvent.setup();
    invokeMock.mockRejectedValue(new Error('Edge function unavailable'));

    render(AdminPanel, {
      props: {
        user: { email: 'admin@example.com' },
        teamName: 'Clontarf',
      },
    });

    await user.type(screen.getByPlaceholderText('analyst@example.com'), 'analyst@example.com');
    await user.type(screen.getByPlaceholderText('Minimum 8 characters'), 'temporary123');
    await user.click(screen.getByRole('button', { name: /Onboard user/i }));

    expect(await screen.findByText(/Edge function unavailable/i)).toBeInTheDocument();
    expect(appendDiagnosticMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'onboarding',
      message: 'Edge function unavailable',
      details: expect.objectContaining({
        email: 'analyst@example.com',
        teamMode: 'current',
        authMode: 'password',
      }),
    }));
  });

  it('surfaces partial onboarding failures when the team assignment was saved first', async () => {
    const user = userEvent.setup();
    invokeMock.mockResolvedValue({
      data: {
        ok: false,
        assignmentSaved: true,
        email: 'analyst@example.com',
        team: { id: 'team-1', name: 'Clontarf', created: false },
        auth: { delivery: 'password', existing: false, invited: false },
        error: 'Team assignment saved, but the sign-in user could not be created: Auth API unavailable',
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

    expect(await screen.findByText(/Team assignment saved, but the sign-in user could not be created/i)).toBeInTheDocument();
    expect(screen.getByText(/Retry this user later to finish the sign-in account step/i)).toBeInTheDocument();
    expect(appendDiagnosticMock).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.objectContaining({
        assignmentSaved: true,
        resolvedTeamName: 'Clontarf',
      }),
    }));
  });

  it('adds roster players and toggles their active state', async () => {
    const user = userEvent.setup();

    render(AdminPanel, {
      props: {
        user: { email: 'admin@example.com' },
        teamName: 'Clontarf',
        storageScope: 'test',
      },
    });

    await user.type(screen.getByPlaceholderText('Add player name'), 'Cian Murphy');
    await user.click(screen.getByRole('button', { name: /Add player/i }));

    expect(screen.getByDisplayValue('Cian Murphy')).toBeInTheDocument();
    expect(screen.getByText(/Player added to the roster\./i)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));

    expect(screen.getByText('Inactive', { selector: '.roster-toggle span' })).toBeInTheDocument();
  });
});
