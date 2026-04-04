import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EventsTable from '../../src/lib/EventsTable.svelte';

function makeEvent(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    ko_sequence: 1,
    match_date: '2026-03-25',
    created_at: '2026-03-25T12:00:00.000Z',
    period: 'H1',
    clock: '05:00',
    event_type: 'kickout',
    direction: 'ours',
    outcome: 'Retained',
    contest_type: 'clean',
    zone_code: 'R-M',
    depth_from_own_goal_m: 42,
    opponent: 'Vincents',
    team: 'Clontarf',
    target_player: '8',
    restart_reason: 'Score',
    score_us: '0-1',
    score_them: '0-0',
    flag: false,
    ...overrides,
  };
}

describe('EventsTable', () => {
  it('filters locally and exports only the filtered view', async () => {
    const user = userEvent.setup();
    const onExportView = vi.fn();
    const events = [
      makeEvent({ id: 'event-1', opponent: 'Vincents', outcome: 'Retained' }),
      makeEvent({ id: 'event-2', opponent: 'Crokes', outcome: 'Lost', ko_sequence: 2 }),
    ];

    render(EventsTable, {
      props: {
        events,
        onExportView,
      },
    });

    await user.type(screen.getByPlaceholderText(/Search type, opponent, clock, player, zone/i), 'Crokes');

    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Export View/i }));

    expect(onExportView).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'event-2', opponent: 'Crokes' }),
    ]);
  });

  it('shows the filtered empty state and lets the user clear local filters', async () => {
    const user = userEvent.setup();
    render(EventsTable, {
      props: {
        events: [makeEvent({ id: 'event-1', opponent: 'Vincents' })],
      },
    });

    await user.type(screen.getByPlaceholderText(/Search type, opponent, clock, player, zone/i), 'Na Fianna');

    expect(screen.getByText(/No events match the current filters/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Clear filters/i }));

    expect(screen.queryByText(/No events match the current filters/i)).not.toBeInTheDocument();
    expect(screen.getByText('Vincents')).toBeInTheDocument();
  });

  it('searches local event metadata beyond opponent names', async () => {
    const user = userEvent.setup();
    render(EventsTable, {
      props: {
        events: [
          makeEvent({ id: 'event-1', event_type: 'shot', clock: '12:34', outcome: 'Wide', shot_type: 'goal' }),
        ],
      },
    });

    await user.type(screen.getByPlaceholderText(/Search type, opponent, clock, player, zone/i), '12:34');

    expect(screen.getByText('12:34')).toBeInTheDocument();
    expect(screen.getByText(/These filters only change the Events table/i)).toBeInTheDocument();
  });

  it('shows the kickout winner team name instead of retained/lost in the outcome column', () => {
    render(EventsTable, {
      props: {
        events: [makeEvent({ id: 'event-1', opponent: 'Vincents', outcome: 'Retained' })],
      },
    });

    expect(screen.getAllByRole('cell', { name: 'Clontarf' })).toHaveLength(1);
    expect(screen.queryByRole('cell', { name: 'Retained' })).not.toBeInTheDocument();
  });

  it('searches turnover loser and winner details in the players column', async () => {
    const user = userEvent.setup();
    render(EventsTable, {
      props: {
        events: [
          makeEvent({
            id: 'turnover-1',
            event_type: 'turnover',
            outcome: 'Won',
            turnover_lost_player: '2',
            turnover_won_player: '14',
            opponent: 'Crokes',
          }),
        ],
      },
    });

    await user.type(screen.getByPlaceholderText(/Search type, opponent, clock, player, zone/i), '#14');

    expect(screen.getByText(/Lost Crokes #2 \/ Won Clontarf #14/i)).toBeInTheDocument();
  });
});
