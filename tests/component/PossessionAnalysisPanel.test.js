import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import PossessionAnalysisPanel from '../../src/lib/PossessionAnalysisPanel.svelte';
import { STORAGE_KEYS, storageKey } from '../../src/lib/storageScope.js';

describe('PossessionAnalysisPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('records a possession event and saves the session for the active match', async () => {
    render(PossessionAnalysisPanel, {
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
    await fireEvent.input(playerInput, { target: { value: '#8' } });

    await fireEvent.click(screen.getByRole('button', { name: /Start draft session/i }));

    const pitch = screen.getByRole('application', { name: /GAA pitch/i });
    await fireEvent.keyDown(pitch, { key: 'Enter' });
    await fireEvent.keyDown(pitch, { key: 'Enter' });

    await fireEvent.click(screen.getByRole('button', { name: /Add draft event/i }));

    expect(screen.getByText('Draft events')).toBeInTheDocument();
    expect(screen.getByText(/1\. Hand pass/i)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Finalize session/i }));

    await screen.findByText('Session finalized.');
    expect(screen.getByText('Saved Sessions')).toBeInTheDocument();
    expect(screen.getByText(/1 events - Our goal left - 2026-04-06/)).toBeInTheDocument();
  });

  it('aggregates possession sessions across matches when cross-match mode is selected', async () => {
    localStorage.setItem(
      storageKey(STORAGE_KEYS.analysis, 'test'),
      JSON.stringify({
        version: 1,
        possessionSessions: [
          {
            id: 'session-1',
            mode: 'possession',
            match_id: 'match-1',
            player_name: 'Cian Murphy',
            player_key: 'squad:p1',
            squad_player_id: 'p1',
            our_goal_at_top: true,
            created_at: '2026-04-01T12:00:00.000Z',
            updated_at: '2026-04-01T12:00:00.000Z',
            notes: '',
            events: [
              {
                id: 'event-1',
                receive_x: 0.25,
                receive_y: 0.3,
                release_x: 0.25,
                release_y: 0.42,
                outcome: 'Passed / offloaded',
                under_pressure: false,
                created_at: '2026-04-01T12:00:00.000Z',
              },
            ],
          },
          {
            id: 'session-2',
            mode: 'possession',
            match_id: 'match-2',
            player_name: 'Cian Murphy',
            player_key: 'squad:p1',
            squad_player_id: 'p1',
            our_goal_at_top: true,
            created_at: '2026-04-08T12:00:00.000Z',
            updated_at: '2026-04-08T12:00:00.000Z',
            notes: '',
            events: [
              {
                id: 'event-2',
                receive_x: 0.3,
                receive_y: 0.28,
                release_x: 0.35,
                release_y: 0.45,
                outcome: 'Score point',
                under_pressure: true,
                created_at: '2026-04-08T12:00:00.000Z',
              },
            ],
          },
        ],
        passSessions: [],
        squadPlayers: [
          { id: 'p1', name: 'Cian Murphy', name_key: 'cian murphy', active: true },
        ],
      }),
    );

    render(PossessionAnalysisPanel, {
      props: {
        storageScope: 'test',
        activeMatchId: 'match-1',
        activeMatch: {
          id: 'match-1',
          match_date: '2026-04-01',
          team: 'Clontarf',
          opponent: 'Vincents',
        },
        matches: [
          { id: 'match-1', team: 'Clontarf', opponent: 'Vincents', match_date: '2026-04-01' },
          { id: 'match-2', team: 'Clontarf', opponent: 'Na Fianna', match_date: '2026-04-08' },
        ],
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        playerOptions: [['8', 'Cian Murphy']],
        squadPlayers: [
          { id: 'p1', name: 'Cian Murphy', name_key: 'cian murphy', active: true },
        ],
        defaultOurGoalAtTop: true,
      },
    });

    const playerStrip = document.querySelector('.player-strip');
    if (!playerStrip) throw new Error('Missing player strip');
    expect(within(playerStrip).getByRole('button', { name: /Cian Murphy/i })).toBeInTheDocument();
    await fireEvent.click(screen.getByRole('button', { name: /Across matches/i }));

    expect(screen.getByRole('button', { name: /Select all/i })).toBeInTheDocument();
    expect(document.querySelectorAll('.cross-row')).toHaveLength(2);
    const totalEventsCard = Array.from(document.querySelectorAll('.summary-grid div')).find(
      (card) => card.textContent?.includes('Total events'),
    );
    expect(totalEventsCard?.querySelector('strong')?.textContent).toBe('2');

    const matchLabel = screen.getByText('Clontarf v Na Fianna (2026-04-08)', {
      selector: '.cross-match-item strong',
    });
    const matchRow = matchLabel.closest('label');
    if (!matchRow) throw new Error('Missing match selector row');
    await fireEvent.click(within(matchRow).getByRole('checkbox'));

    const updatedTotalEventsCard = Array.from(document.querySelectorAll('.summary-grid div')).find(
      (card) => card.textContent?.includes('Total events'),
    );
    expect(updatedTotalEventsCard?.querySelector('strong')?.textContent).toBe('1');
  });
});
