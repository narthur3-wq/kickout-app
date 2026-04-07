import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import PassImpactPanel from '../../src/lib/PassImpactPanel.svelte';
import { STORAGE_KEYS, storageKey } from '../../src/lib/storageScope.js';

describe('PassImpactPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows saved pass summaries and opens a connection detail card', async () => {
    localStorage.setItem(
      storageKey(STORAGE_KEYS.analysis, 'test'),
      JSON.stringify({
        version: 1,
        possessionSessions: [],
        squadPlayers: [
          {
            id: 'player-1',
            name: 'Aoife Kelly',
            name_key: 'aoife kelly',
            active: true,
            created_at: '2026-04-01T12:00:00.000Z',
            updated_at: '2026-04-01T12:00:00.000Z',
          },
        ],
        passSessions: [
          {
            id: 'pass-session-1',
            mode: 'pass',
            match_id: 'match-1',
            player_name: 'aoife kelly',
            player_key: 'squad:player-1',
            squad_player_id: 'player-1',
            our_goal_at_top: false,
            created_at: '2026-04-01T12:00:00.000Z',
            updated_at: '2026-04-01T12:00:00.000Z',
            notes: '',
            events: [
              {
                id: 'pass-1',
                from_x: 0.2,
                from_y: 0.8,
                to_x: 0.4,
                to_y: 0.5,
                pass_type: 'Kickpass',
                completed: true,
                created_at: '2026-04-01T12:00:00.000Z',
              },
            ],
          },
        ],
      }),
    );

    render(PassImpactPanel, {
      props: {
        storageScope: 'test',
        activeMatchId: 'match-1',
        activeMatch: {
          id: 'match-1',
          match_date: '2026-04-01',
          team: 'Clontarf',
          opponent: 'Vincents',
        },
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        playerOptions: [['8', '#8']],
        defaultOurGoalAtTop: true,
      },
    });

    const playerInput = screen.getByPlaceholderText('Type a player');
    expect(playerInput).toBeEnabled();

    expect(screen.getByText('Pass Destination')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Aoife Kelly 1$/ })).toBeInTheDocument();
    expect(screen.getByText('Total passes')).toBeInTheDocument();
    expect(screen.getAllByText('100%', { selector: '.summary-grid strong' })).toHaveLength(2);

    const line = document.querySelector('line[aria-label^="1 pass"]');
    if (!line) throw new Error('Missing pass connection line');
    await fireEvent.click(line);

    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Forward')).toBeInTheDocument();
    expect(screen.getByText('+43.5m', { selector: '.detail-grid strong' })).toBeInTheDocument();
  });

  it('shows draft passes immediately before finalizing the session', async () => {
    render(PassImpactPanel, {
      props: {
        storageScope: 'test',
        activeMatchId: 'match-1',
        activeMatch: {
          id: 'match-1',
          match_date: '2026-04-01',
          team: 'Clontarf',
          opponent: 'Vincents',
        },
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        playerOptions: [['8', '#8']],
        defaultOurGoalAtTop: true,
      },
    });

    const playerInput = screen.getByPlaceholderText('Type a player');
    await fireEvent.input(playerInput, { target: { value: '#8' } });
    await fireEvent.click(screen.getByRole('button', { name: /Start draft session/i }));

    const pitch = screen.getByRole('application', { name: /GAA pitch/i });
    await fireEvent.keyDown(pitch, { key: 'Enter' });
    await fireEvent.keyDown(pitch, { key: 'Enter' });

    await fireEvent.click(screen.getByRole('button', { name: /Add draft pass/i }));

    expect(screen.getByText('Draft passes')).toBeInTheDocument();
    expect(screen.getByText(/1\. Kickpass/i)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Finalize session/i }));
    expect(await screen.findByText('Session finalized.')).toBeInTheDocument();
  });
});
