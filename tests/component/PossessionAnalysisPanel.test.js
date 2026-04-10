import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import PossessionAnalysisPanel from '../../src/lib/PossessionAnalysisPanel.svelte';
import { saveAnalysisUiState } from '../../src/lib/analysisUiState.js';
import { STORAGE_KEYS, storageKey } from '../../src/lib/storageScope.js';

const ANALYSIS_STORAGE_KEY = storageKey(STORAGE_KEYS.analysis, 'test');

function seedAnalysisState({ sessions = [], squadPlayers = [] } = {}) {
  localStorage.setItem(
    ANALYSIS_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      possessionSessions: sessions,
      passSessions: [],
      squadPlayers,
    }),
  );
}

function seedViewState(overrides = {}) {
  saveAnalysisUiState('possession', 'test', {
    analysisMode: 'match',
    selectedHalf: null,
    viewMode: 'dots',
    showPressureOnly: false,
    showScoreInvolvementsOnly: false,
    showCarryLines: true,
    actionFamilyFilter: 'all',
    pathLayerFilter: 'all',
    legendOpen: false,
    trendMode: 'halves',
    trendLastN: 3,
    trendFocus: 'earlier',
    selectedPlayerKey: 'squad:p1',
    selectedSessionId: 'all',
    selectedCrossMatchIds: ['match-1'],
    playerInput: 'Cian Murphy',
    ...overrides,
  });
}

function renderPanel(overrides = {}) {
  return render(PossessionAnalysisPanel, {
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
      ...overrides,
    },
  });
}

function summaryValue(label) {
  const card = Array.from(document.querySelectorAll('.summary-grid div')).find(
    (item) => item.querySelector('span')?.textContent?.trim() === label,
  );
  return card?.querySelector('strong')?.textContent ?? null;
}

describe('PossessionAnalysisPanel', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('records a possession event and saves the session for the active match', async () => {
    const today = new Date().toISOString().slice(0, 10);

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
    await fireEvent.click(screen.getByRole('button', { name: /Review event/i }));
    await fireEvent.keyDown(pitch, { key: 'Enter' });

    await fireEvent.click(screen.getByRole('button', { name: /Add draft event/i }));

    expect(screen.getByText('Draft events')).toBeInTheDocument();
    expect(screen.getByText(/1\. Hand pass/i)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Finalize session/i }));

    await screen.findByText('Session finalized.');
    expect(screen.getByText('Saved Sessions')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`1 events - Our goal left - ${today}`))).toBeInTheDocument();
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
    saveAnalysisUiState('possession', 'test', {
      analysisMode: 'cross',
      selectedHalf: null,
      viewMode: 'dots',
      showPressureOnly: false,
      showScoreInvolvementsOnly: false,
      showCarryLines: true,
      legendOpen: false,
      trendMode: 'halves',
      trendLastN: 3,
      trendFocus: 'earlier',
      selectedPlayerKey: 'squad:p1',
      selectedSessionId: 'all',
      selectedCrossMatchIds: ['match-1', 'match-2'],
      playerInput: 'Cian Murphy',
    });

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

    await waitFor(() => expect(document.querySelectorAll('.cross-row')).toHaveLength(2));
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

  it('restores the last analysis view from stored UI preferences', async () => {
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
                under_pressure: true,
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

    saveAnalysisUiState('possession', 'test', {
      analysisMode: 'cross',
      selectedHalf: 'second',
      viewMode: 'heat',
      showPressureOnly: true,
      showScoreInvolvementsOnly: false,
      showCarryLines: true,
      legendOpen: false,
      trendMode: 'halves',
      trendLastN: 3,
      trendFocus: 'earlier',
      selectedPlayerKey: 'squad:p1',
      selectedSessionId: 'all',
      selectedCrossMatchIds: ['match-1', 'match-2'],
      playerInput: 'Cian Murphy',
    });

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

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Across matches$/i })).toHaveClass('active');
      const restoredHalfFilterRow = document.querySelector('.filter-row[aria-label="Half filter"]');
      if (!restoredHalfFilterRow) throw new Error('Missing half filter row after remount');
      expect(within(restoredHalfFilterRow).getByRole('button', { name: /^Second half$/i })).toHaveClass('active');
      expect(screen.getByRole('button', { name: /^Heat$/i })).toHaveClass('active');
      expect(screen.getByRole('button', { name: /Under pressure only/i })).toHaveClass('active');
    });
  });

  it('shows ball-path summaries and applies action plus path filters in the analysis view', async () => {
    seedAnalysisState({
      sessions: [
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
              receive_x: 0.2,
              receive_y: 0.2,
              release_x: 0.2,
              release_y: 0.4,
              target_x: 0.2,
              target_y: 0.5,
              outcome: 'Hand pass',
              under_pressure: false,
              created_at: '2026-04-01T12:00:00.000Z',
            },
            {
              id: 'event-2',
              receive_x: 0.3,
              receive_y: 0.35,
              release_x: 0.3,
              release_y: 0.55,
              outcome: 'Score point',
              under_pressure: true,
              created_at: '2026-04-01T12:02:00.000Z',
            },
          ],
        },
      ],
      squadPlayers: [
        { id: 'p1', name: 'Cian Murphy', name_key: 'cian murphy', active: true },
      ],
    });
    seedViewState();

    const { container } = renderPanel();

    await waitFor(() => expect(summaryValue('Total events')).toBe('2'));
    expect(summaryValue('Ball paths')).toBe('1');
    expect(summaryValue('Avg ball')).toBe('14.5m');
    expect(document.querySelector('.outcome-list')?.textContent).toContain('Hand pass');
    expect(document.querySelector('.outcome-list')?.textContent).toContain('Score point');
    expect(container.querySelectorAll('svg polygon')).toHaveLength(3);

    await fireEvent.click(screen.getByRole('button', { name: /^Passes$/i }));

    await waitFor(() => expect(summaryValue('Total events')).toBe('1'));
    expect(document.querySelector('.outcome-list')?.textContent).toContain('Hand pass');
    expect(document.querySelector('.outcome-list')?.textContent).not.toContain('Score point');

    await fireEvent.click(screen.getByRole('button', { name: /^Ball only$/i }));

    await waitFor(() => expect(container.querySelectorAll('svg polygon')).toHaveLength(1));
  });

  it('lets analysts correct a saved release point from the pitch handle and persists the updated geometry', async () => {
    seedAnalysisState({
      sessions: [
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
              receive_x: 0.2,
              receive_y: 0.2,
              release_x: 0.2,
              release_y: 0.4,
              target_x: 0.2,
              target_y: 0.5,
              outcome: 'Hand pass',
              under_pressure: false,
              created_at: '2026-04-01T12:00:00.000Z',
            },
          ],
        },
      ],
      squadPlayers: [
        { id: 'p1', name: 'Cian Murphy', name_key: 'cian murphy', active: true },
      ],
    });
    seedViewState();

    renderPanel();

    await waitFor(() => expect(summaryValue('Total events')).toBe('1'));

    const overlay = document.querySelector('.pitch-frame [role="button"][aria-label="Hand pass - Forward"]');
    if (!overlay) throw new Error('Missing event overlay button');

    await fireEvent.click(overlay);
    await screen.findByText('Edit event');

    const handle = screen.getByRole('button', { name: /Drag release point/i });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });

    await waitFor(() => expect(screen.getAllByText('0.20, 0.41').length).toBeGreaterThan(0));

    await fireEvent.click(screen.getByRole('button', { name: /Save changes/i }));

    const savedState = JSON.parse(localStorage.getItem(ANALYSIS_STORAGE_KEY) || '{}');
    expect(savedState.possessionSessions?.[0]?.events?.[0]).toMatchObject({
      release_x: 0.2,
      release_y: 0.41,
      target_x: 0.2,
      target_y: 0.5,
    });
  });
});
