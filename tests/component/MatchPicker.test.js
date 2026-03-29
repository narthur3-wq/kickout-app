import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import MatchPicker from '../../src/lib/MatchPicker.svelte';

function makeMatch(overrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    team: overrides.team ?? 'Clontarf',
    opponent: overrides.opponent ?? 'Kilmacud Crokes',
    match_date: overrides.match_date ?? '2026-03-29',
    status: overrides.status ?? 'open',
    created_at: overrides.created_at ?? '2026-03-29T10:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-03-29T10:00:00.000Z',
    last_event_at: overrides.last_event_at ?? null,
    closed_at: overrides.closed_at ?? null,
  };
}

describe('MatchPicker', () => {
  it('renders the current match plus open and recent closed sections', () => {
    render(MatchPicker, {
      props: {
        matches: [
          makeMatch({ id: 'open-1', opponent: 'Crokes', last_event_at: '2026-03-29T12:00:00.000Z' }),
          makeMatch({ id: 'open-2', opponent: 'Na Fianna', last_event_at: '2026-03-28T12:00:00.000Z' }),
          makeMatch({ id: 'closed-1', opponent: 'Boden', match_date: '2026-03-27', status: 'closed', closed_at: '2026-03-27T12:00:00.000Z' }),
        ],
        activeMatchId: 'open-1',
        isMatchClosed: false,
      },
    });

    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getAllByText('Clontarf v Crokes')).toHaveLength(2);
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent closed')).toBeInTheDocument();
    expect(screen.getByText(/2026-03-27 · Closed/i)).toBeInTheDocument();
  });

  it('dispatches select when the analyst chooses another match', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(MatchPicker, {
      props: {
        matches: [
          makeMatch({ id: 'open-1', opponent: 'Crokes' }),
          makeMatch({ id: 'open-2', opponent: 'Na Fianna' }),
        ],
        activeMatchId: 'open-1',
        isMatchClosed: false,
      },
      events: {
        select: onSelect,
      },
    });

    await user.click(screen.getByRole('button', { name: /Clontarf v Na Fianna/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ detail: 'open-2' }));
  });

  it('dispatches create from the new-match form', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    render(MatchPicker, {
      props: {
        matches: [],
        activeMatchId: null,
        isMatchClosed: false,
      },
      events: {
        create: onCreate,
      },
    });

    await user.click(screen.getByRole('button', { name: /\+ New match/i }));
    await user.type(screen.getByLabelText('Team'), 'Clontarf');
    await user.type(screen.getByLabelText('Opponent'), 'Na Fianna');
    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2026-04-01');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        team: 'Clontarf',
        opponent: 'Na Fianna',
        match_date: '2026-04-01',
      },
    }));
  });

  it('dispatches edit for the active match', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(MatchPicker, {
      props: {
        matches: [makeMatch({ id: 'open-1', opponent: 'Crokes' })],
        activeMatchId: 'open-1',
        isMatchClosed: false,
      },
      events: {
        edit: onEdit,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Opponent'));
    await user.type(screen.getByLabelText('Opponent'), 'St Vincents');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({
      detail: expect.objectContaining({
        team: 'Clontarf',
        opponent: 'St Vincents',
      }),
    }));
  });

  it('dispatches close and reopen actions for the active match', async () => {
    const user = userEvent.setup();
    const onCloseMatch = vi.fn();
    const onReopenMatch = vi.fn();

    const { rerender } = render(MatchPicker, {
      props: {
        matches: [makeMatch({ id: 'open-1', opponent: 'Crokes' })],
        activeMatchId: 'open-1',
        isMatchClosed: false,
      },
      events: {
        'close-match': onCloseMatch,
        'reopen-match': onReopenMatch,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Close match' }));
    expect(onCloseMatch).toHaveBeenCalledTimes(1);

    await rerender({
      matches: [makeMatch({ id: 'open-1', opponent: 'Crokes', status: 'closed', closed_at: '2026-03-29T11:00:00.000Z' })],
      activeMatchId: 'open-1',
      isMatchClosed: true,
    });

    await user.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(onReopenMatch).toHaveBeenCalledTimes(1);
  });
});
