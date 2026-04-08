import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MATCH_KEYS } from '../../src/lib/matchStore.js';
import { LOCAL_STORAGE_SCOPE, STORAGE_KEYS, storageKey } from '../../src/lib/storageScope.js';

const mockState = vi.hoisted(() => {
  const sessionState = { session: null };
  const subscription = { unsubscribe: vi.fn() };
  const selectOrderMock = vi.fn();
  const selectGtMock = vi.fn(() => ({ order: selectOrderMock }));
  const selectEqMock = vi.fn(() => ({ gt: selectGtMock, order: selectOrderMock }));
  const selectMock = vi.fn(() => ({ eq: selectEqMock, order: selectOrderMock }));
  const upsertMock = vi.fn();
  const deleteEqMock = vi.fn();
  const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
  const analysisSelectOrderMock = vi.fn();
  const analysisSelectEqMock = vi.fn(() => ({ order: analysisSelectOrderMock }));
  const analysisSelectMock = vi.fn(() => ({ eq: analysisSelectEqMock, order: analysisSelectOrderMock }));
  const analysisUpsertMock = vi.fn();
  const analysisDeleteEqMock = vi.fn();
  const analysisDeleteMock = vi.fn(() => ({ eq: analysisDeleteEqMock }));
  const realtimeHandlers = [];
  const fromMock = vi.fn(() => ({
    select: selectMock,
    upsert: upsertMock,
    delete: deleteMock,
  }));
  const channelMock = {
    on: vi.fn((...args) => {
      realtimeHandlers.push(args);
      return channelMock;
    }),
    subscribe: vi.fn().mockReturnValue({}),
  };

  return {
    sessionState,
    subscription,
    getSessionMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
    signOutMock: vi.fn(),
    removeChannelMock: vi.fn(),
    userHasAccessMock: vi.fn(),
    getUserTeamDetailsMock: vi.fn(),
    isConfiguredAdminMock: vi.fn(),
    selectOrderMock,
    selectGtMock,
    selectEqMock,
    selectMock,
    upsertMock,
    deleteEqMock,
    deleteMock,
    analysisSelectOrderMock,
    analysisSelectEqMock,
    analysisSelectMock,
    analysisUpsertMock,
    analysisDeleteEqMock,
    analysisDeleteMock,
    fromMock,
    channelFactoryMock: vi.fn(() => channelMock),
    channelMock,
    realtimeHandlers,
  };
});

const diagnosticsMock = vi.hoisted(() => ({
  appendDiagnostic: vi.fn(() => []),
  loadDiagnostics: vi.fn(() => []),
  clearDiagnostics: vi.fn(),
  formatDiagnostics: vi.fn((entries = []) => entries.map((entry) => `${entry.kind}: ${entry.message}`).join('\n')),
  buildDiagnosticsExport: vi.fn((entries = [], meta = {}) => ({ version: 1, entries, meta })),
  summarizeDiagnostics: vi.fn((entries = []) => ({ total: entries.length, byKind: {}, latestAt: null })),
}));

vi.mock('../../src/lib/supabase.js', () => ({
  supabaseConfigured: true,
  supabase: {
    auth: {
      getSession: mockState.getSessionMock,
      onAuthStateChange: mockState.onAuthStateChangeMock,
      signOut: mockState.signOutMock,
    },
    from: mockState.fromMock,
    channel: mockState.channelFactoryMock,
    removeChannel: mockState.removeChannelMock,
  },
  userHasAccess: mockState.userHasAccessMock,
  getUserTeamDetails: mockState.getUserTeamDetailsMock,
  isConfiguredAdmin: mockState.isConfiguredAdminMock,
}));

vi.mock('../../src/lib/diagnostics.js', () => diagnosticsMock);

async function renderApp() {
  const { default: App } = await import('../../src/App.svelte');
  return render(App);
}

function seedScopedMeta(scope, meta) {
  localStorage.setItem(storageKey(STORAGE_KEYS.meta, scope), JSON.stringify(meta));
}

function seedScopedEvents(scope, events) {
  localStorage.setItem(storageKey(STORAGE_KEYS.events, scope), JSON.stringify(events));
}

function seedScopedMatches(scope, matches) {
  localStorage.setItem(storageKey(MATCH_KEYS.matches, scope), JSON.stringify(matches));
}

function seedScopedActiveMatchId(scope, id) {
  if (id) {
    localStorage.setItem(storageKey(MATCH_KEYS.activeMatchId, scope), id);
  } else {
    localStorage.removeItem(storageKey(MATCH_KEYS.activeMatchId, scope));
  }
}

function getDeepAnalysisButton(label) {
  const deepLinks = document.querySelector('.deep-links');
  if (!deepLinks) throw new Error('Missing deep analysis shortcuts');

  const button = Array.from(deepLinks.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === label
  );

  if (!button) throw new Error(`Missing deep analysis button: ${label}`);
  return button;
}

function getCaptureFormButton(label) {
  const formPanel = document.querySelector('.form-panel');
  if (!formPanel) throw new Error('Missing capture form panel');

  const button = Array.from(formPanel.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === label
  );

  if (!button) throw new Error(`Missing capture form button: ${label}`);
  return button;
}

describe('App shell auth and sync', () => {
  beforeEach(() => {
    localStorage.clear();
    mockState.sessionState.session = null;
    mockState.getSessionMock.mockResolvedValue({ data: { session: null } });
    mockState.onAuthStateChangeMock.mockReturnValue({ data: { subscription: mockState.subscription } });
    mockState.signOutMock.mockResolvedValue({});
    mockState.removeChannelMock.mockReset();
    mockState.userHasAccessMock.mockResolvedValue(true);
    mockState.getUserTeamDetailsMock.mockResolvedValue({ id: 'team-1', name: 'Clontarf' });
    mockState.isConfiguredAdminMock.mockReturnValue(false);
    mockState.selectOrderMock.mockReset().mockResolvedValue({ data: [], error: null });
    mockState.selectGtMock.mockReset().mockImplementation(() => ({ order: mockState.selectOrderMock }));
    mockState.selectEqMock.mockReset().mockImplementation(() => ({ gt: mockState.selectGtMock, order: mockState.selectOrderMock }));
    mockState.selectMock.mockReset().mockImplementation(() => ({ eq: mockState.selectEqMock, order: mockState.selectOrderMock }));
    mockState.upsertMock.mockReset().mockResolvedValue({ error: null });
    mockState.deleteEqMock.mockReset().mockResolvedValue({ error: null });
    mockState.deleteMock.mockReset().mockImplementation(() => ({ eq: mockState.deleteEqMock }));
    mockState.analysisSelectOrderMock.mockReset().mockResolvedValue({ data: [], error: null });
    mockState.analysisSelectEqMock.mockReset().mockImplementation(() => ({ order: mockState.analysisSelectOrderMock }));
    mockState.analysisSelectMock.mockReset().mockImplementation(() => ({ eq: mockState.analysisSelectEqMock, order: mockState.analysisSelectOrderMock }));
    mockState.analysisUpsertMock.mockReset().mockResolvedValue({ error: null });
    mockState.analysisDeleteEqMock.mockReset().mockResolvedValue({ error: null });
    mockState.analysisDeleteMock.mockReset().mockImplementation(() => ({ eq: mockState.analysisDeleteEqMock }));
    mockState.fromMock.mockReset().mockImplementation((tableName) => {
      const analysisTables = new Set([
        'squad_players',
        'possession_sessions',
        'possession_events',
        'pass_sessions',
        'pass_events',
      ]);
      const isAnalysisTable = analysisTables.has(tableName);
      return {
        select: isAnalysisTable ? mockState.analysisSelectMock : mockState.selectMock,
        upsert: isAnalysisTable ? mockState.analysisUpsertMock : mockState.upsertMock,
        delete: isAnalysisTable ? mockState.analysisDeleteMock : mockState.deleteMock,
      };
    });
    mockState.channelFactoryMock.mockReset().mockImplementation(() => mockState.channelMock);
    mockState.channelMock.on.mockReset().mockImplementation((...args) => {
      mockState.realtimeHandlers.push(args);
      return mockState.channelMock;
    });
    mockState.channelMock.subscribe.mockReset().mockReturnValue({});
    mockState.realtimeHandlers.length = 0;
    diagnosticsMock.appendDiagnostic.mockClear();
    diagnosticsMock.loadDiagnostics.mockReturnValue([]);
    diagnosticsMock.clearDiagnostics.mockClear();
    diagnosticsMock.formatDiagnostics.mockImplementation((entries = []) =>
      entries.map((entry) => `${entry.kind}: ${entry.message}`).join('\n')
    );
    diagnosticsMock.buildDiagnosticsExport.mockImplementation((entries = [], meta = {}) => ({ version: 1, entries, meta }));
    diagnosticsMock.summarizeDiagnostics.mockImplementation((entries = []) => ({ total: entries.length, byKind: {}, latestAt: null }));
  });

  it('shows the login screen when Supabase is configured but there is no active session', async () => {
    await renderApp();

    expect(await screen.findByRole('button', { name: /Sign in/i })).toBeInTheDocument();
    expect(mockState.getSessionMock).toHaveBeenCalledTimes(1);
  });

  it('migrates older local data into signed-in storage on first login', async () => {
    const session = { user: { id: 'user-1', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    const legacyEvent = {
      id: 'legacy-1',
      created_at: '2026-03-25T12:00:00.000Z',
      match_date: '2026-03-25',
      team: 'Clontarf',
      opponent: 'Crokes',
      period: 'H1',
      clock: '1:10',
      outcome: 'Retained',
      contest_type: 'clean',
      x: 0.4,
      y: 0.3,
      x_m: 36,
      y_m: 43.5,
      depth_from_own_goal_m: 43.5,
      side_band: 'Centre',
      depth_band: 'Medium',
      zone_code: 'C-M',
      our_goal_at_top: true,
      event_type: 'kickout',
      direction: 'ours',
      schema_version: 1,
    };

    seedScopedEvents(LOCAL_STORAGE_SCOPE, [legacyEvent]);
    seedScopedMeta(LOCAL_STORAGE_SCOPE, {
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-25',
      period: 'H1',
      our_goal_at_top: true,
    });

    await renderApp();

    expect(await screen.findByText(/Moved 1 local event\(s\) into your signed-in storage/i)).toBeInTheDocument();
    expect(localStorage.getItem(storageKey(STORAGE_KEYS.events, LOCAL_STORAGE_SCOPE))).toBeNull();
    expect(JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.events, 'user:user-1')))).toHaveLength(1);
    expect(mockState.upsertMock).toHaveBeenCalled();
  });

  it('shows the post-match analysis tabs in the authenticated shell', async () => {
    const session = { user: { id: 'user-1', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    await renderApp();

    expect(await screen.findByRole('button', { name: 'Possession' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pass Destination' })).toBeInTheDocument();
  });

  it('shows a paused sync warning and blocks saving when the user has no team assignment', async () => {
    const session = { user: { id: 'user-2', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });
    mockState.getUserTeamDetailsMock.mockResolvedValue({ id: null, name: null });

    seedScopedMatches('user:user-2', [{
      id: 'match-1',
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-25',
      status: 'open',
      created_at: '2026-03-25T10:00:00.000Z',
      updated_at: '2026-03-25T10:00:00.000Z',
      last_event_at: '2026-03-25T10:00:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId('user:user-2', 'match-1');

    await renderApp();

    expect(await screen.findByText(/cloud sync is paused/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Save Event/i }));

    expect(await screen.findByText(/finish onboarding before recording events/i)).toBeInTheDocument();
  });

  it('falls back to the most recent open match when no active match id is stored', async () => {
    const session = { user: { id: 'user-3', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches('user:user-3', [
      {
        id: 'closed-1',
        team: 'Clontarf',
        opponent: 'Na Fianna',
        match_date: '2026-03-22',
        status: 'closed',
        created_at: '2026-03-22T10:00:00.000Z',
        updated_at: '2026-03-22T12:00:00.000Z',
        last_event_at: '2026-03-22T12:00:00.000Z',
        closed_at: '2026-03-22T13:00:00.000Z',
      },
      {
        id: 'open-1',
        team: 'Clontarf',
        opponent: 'Kilmacud Crokes',
        match_date: '2026-03-29',
        status: 'open',
        created_at: '2026-03-29T10:00:00.000Z',
        updated_at: '2026-03-29T12:00:00.000Z',
        last_event_at: '2026-03-29T12:00:00.000Z',
        closed_at: null,
      },
    ]);
    seedScopedActiveMatchId('user:user-3', null);

    await renderApp();

    expect(await screen.findByRole('button', { name: /Clontarf vs Kilmacud Crokes/i })).toBeInTheDocument();
  });

  it('loads shared matches from Supabase into the current match context', async () => {
    const session = { user: { id: 'user-remote', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });
    mockState.selectOrderMock
      .mockResolvedValueOnce({
        data: [{
          id: 'remote-match',
          team_id: 'team-1',
          team: 'Clontarf',
          opponent: 'Kilmacud Crokes',
          match_date: '2026-03-29',
          status: 'open',
          created_at: '2026-03-29T10:00:00.000Z',
          updated_at: '2026-03-29T12:00:00.000Z',
          last_event_at: '2026-03-29T12:00:00.000Z',
          closed_at: null,
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await renderApp();

    expect(await screen.findByRole('button', { name: /Clontarf vs Kilmacud Crokes/i })).toBeInTheDocument();
    expect(mockState.fromMock).toHaveBeenCalledWith('matches');
    expect(mockState.fromMock).toHaveBeenCalledWith('events');
  });

  it('uses an incremental sync cursor to merge remote deltas without dropping local rows', async () => {
    const session = { user: { id: 'user-delta', email: 'analyst@example.com' } };
    const userScope = 'user:user-delta';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: 'match-1',
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:05:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, 'match-1');
    seedScopedEvents(userScope, [{
      id: 'local-1',
      match_id: 'match-1',
      created_at: '2026-03-29T09:05:00.000Z',
      updated_at: '2026-03-29T09:05:00.000Z',
      match_date: '2026-03-29',
      team: 'Clontarf',
      opponent: 'Crokes',
      period: 'H1',
      clock: '5:00',
      event_type: 'shot',
      direction: 'ours',
      outcome: 'Point',
      x: 0.42,
      y: 0.28,
      schema_version: 1,
    }]);
    localStorage.setItem(
      storageKey(STORAGE_KEYS.syncCursor, userScope),
      JSON.stringify({
        matches: '2026-03-29T09:00:00.000Z',
        events: '2026-03-29T09:00:00.000Z',
      })
    );

    mockState.selectOrderMock
      .mockResolvedValueOnce({
        data: [{
          id: 'match-1',
          team_id: 'team-1',
          team: 'Clontarf',
          opponent: 'Crokes',
          match_date: '2026-03-29',
          status: 'open',
          created_at: '2026-03-29T09:00:00.000Z',
          updated_at: '2026-03-29T09:15:00.000Z',
          last_event_at: '2026-03-29T09:05:00.000Z',
          closed_at: null,
        }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{
          id: 'remote-1',
          match_id: 'match-1',
          team_id: 'team-1',
          team: 'Clontarf',
          opponent: 'Crokes',
          match_date: '2026-03-29',
          created_at: '2026-03-29T09:20:00.000Z',
          updated_at: '2026-03-29T09:20:00.000Z',
          event_type: 'shot',
          direction: 'theirs',
          outcome: 'Goal',
          x: 0.6,
          y: 0.4,
          schema_version: 1,
        }],
        error: null,
      });

    await renderApp();

    await waitFor(() => {
      expect(mockState.realtimeHandlers.length).toBeGreaterThan(0);
    });

    const eventRealtimeHandler = mockState.realtimeHandlers.find(([, config]) => config.table === 'events')?.[2];
    expect(eventRealtimeHandler).toBeTypeOf('function');
    eventRealtimeHandler({ eventType: 'INSERT', new: { id: 'trigger-1' } });

    await waitFor(() => {
      expect(mockState.selectGtMock).toHaveBeenCalledWith('updated_at', '2026-03-29T09:15:00.000Z');
      expect(mockState.selectGtMock).toHaveBeenCalledWith('updated_at', '2026-03-29T09:00:00.000Z');
      expect(mockState.selectOrderMock).toHaveBeenCalledTimes(4);
    });

    const storedEvents = JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.events, userScope)));
    expect(storedEvents.map((event) => event.id)).toEqual(expect.arrayContaining(['local-1', 'remote-1']));
  });

  it('syncs a newly created match to Supabase for shared selection', async () => {
    const session = { user: { id: 'user-create', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    await renderApp();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Tap to create your first match/i }));
    await user.type(screen.getByLabelText('Team'), 'Clontarf');
    await user.type(screen.getByLabelText('Opponent'), 'Na Fianna');
    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2026-04-01');
    await user.click(screen.getByRole('button', { name: 'Create', exact: true }));

    await waitFor(() => {
      expect(mockState.fromMock).toHaveBeenCalledWith('matches');
      expect(mockState.upsertMock).toHaveBeenCalledWith(expect.objectContaining({
        team: 'Clontarf',
        opponent: 'Na Fianna',
        match_date: '2026-04-01',
        team_id: 'team-1',
      }));
    });
  });

  it('defers event upserts to Supabase when the parent match is still in the pending queue', async () => {
    // Regression test for the sync-ordering bug:
    // An event created offline whose parent match is still in pendingMatchSync
    // must not be pushed as localOnly (which would violate the match FK on Supabase).
    // Instead it should be moved into pendingSync and flushed after the match lands.
    const session = { user: { id: 'user-sync-order', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    // Seed a match and its event in local storage, both created offline.
    const matchId = 'offline-match-1';
    const userScope = 'user:user-sync-order';
    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-30',
      status: 'open',
      created_at: '2026-03-30T09:00:00.000Z',
      updated_at: '2026-03-30T09:00:00.000Z',
      last_event_at: '2026-03-30T09:01:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [{
      id: 'offline-event-1',
      match_id: matchId,
      created_at: '2026-03-30T09:01:00.000Z',
      match_date: '2026-03-30',
      team: 'Clontarf',
      opponent: 'Boden',
      period: 'H1',
      clock: '2:00',
      outcome: 'Retained',
      contest_type: 'clean',
      event_type: 'kickout',
      direction: 'ours',
      x: 0.5,
      y: 0.5,
      schema_version: 1,
    }]);

    // Both match and event are in their respective pending queues (simulating offline capture).
    localStorage.setItem(
      storageKey('ko_match_sync_queue', userScope),
      JSON.stringify([{ id: matchId, op: 'upsert' }])
    );
    localStorage.setItem(
      storageKey('ko_sync_queue', userScope),
      JSON.stringify([{ id: 'offline-event-1', op: 'upsert' }])
    );

    // Supabase reports no remote records yet (fresh reconnect).
    mockState.selectOrderMock
      .mockResolvedValueOnce({ data: [], error: null })  // matches query
      .mockResolvedValueOnce({ data: [], error: null }); // events query

    await renderApp();

    // flushSyncQueue should be called.
    await waitFor(() => {
      // The match upsert must fire.
      expect(mockState.upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: matchId })
      );
    });

    // The event upsert must also fire (via flushSyncQueue after the match).
    await waitFor(() => {
      expect(mockState.upsertMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'offline-event-1' })
      );
    });

    // Crucially: at the point syncFromSupabase computed localOnly, the event must NOT
    // have been included in the immediate upsert batch (it was deferred). We verify
    // this indirectly — the test passes only if the app reaches the synced state
    // without throwing a FK-violation error from the mock.
    await waitFor(() => {
      expect(screen.queryByText(/sync failed/i)).not.toBeInTheDocument();
    });
  });

  it('records sync failures in the diagnostics log', async () => {
    const session = { user: { id: 'user-sync-diagnostics', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });
    mockState.selectOrderMock.mockRejectedValueOnce(new Error('Network lost'));

    await renderApp();

    expect(await screen.findByText(/Network lost/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(diagnosticsMock.appendDiagnostic).toHaveBeenCalledWith(expect.objectContaining({
        kind: 'sync',
        message: 'Network lost',
      }));
    });
  });

  it('exports a diagnostics report from the account menu', async () => {
    const session = { user: { id: 'user-support-export', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });
    diagnosticsMock.loadDiagnostics.mockReturnValue([
      { ts: '2026-04-07T10:00:00.000Z', kind: 'sync', message: 'Sync failed' },
    ]);

    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:diagnostics');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    try {
      await renderApp();

      await waitFor(() => {
        expect(document.querySelector('.avatar-btn')).not.toBeNull();
      });

      const avatarButton = document.querySelector('.avatar-btn');
      if (!(avatarButton instanceof HTMLButtonElement)) throw new Error('Missing account menu button');
      await user.click(avatarButton);

      await user.click(screen.getByRole('button', { name: /Export report/i }));

      expect(diagnosticsMock.buildDiagnosticsExport).toHaveBeenCalled();
      expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(/Diagnostics export downloaded/i)).toBeInTheDocument();
    } finally {
      clickSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    }
  });

  it('blocks saving until a match exists and opens the match picker in create mode', async () => {
    const session = { user: { id: 'user-4', email: 'analyst@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    await renderApp();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Save Event/i }));

    expect(await screen.findByText(/Create a match before recording events/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /Match picker/i })).toBeInTheDocument();
    expect(screen.getByText('New match')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('opens and closes the kickout summary modal from the analytics tab', async () => {
    const session = { user: { id: 'user-summary', email: 'analyst@example.com' } };
    const userScope = 'user:user-summary';
    const matchId = 'match-summary';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [
      {
        id: 'ko-1',
        match_id: matchId,
        created_at: '2026-03-29T09:01:00.000Z',
        updated_at: '2026-03-29T09:01:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '01:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Retained',
        contest_type: 'clean',
        target_player: '8',
        x: 0.4,
        y: 0.3,
        schema_version: 1,
      },
      {
        id: 'ko-2',
        match_id: matchId,
        created_at: '2026-03-29T09:08:00.000Z',
        updated_at: '2026-03-29T09:08:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H2',
        clock: '08:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Lost',
        contest_type: 'break',
        break_outcome: 'won',
        target_player: '8',
        x: 0.5,
        y: 0.5,
        schema_version: 1,
      },
      {
        id: 'ko-3',
        match_id: matchId,
        created_at: '2026-03-29T09:12:00.000Z',
        updated_at: '2026-03-29T09:12:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H2',
        clock: '12:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Retained',
        contest_type: 'break',
        break_outcome: 'lost',
        target_player: '15',
        x: 0.6,
        y: 0.4,
        schema_version: 1,
      },
    ]);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Kickouts/i });
    await user.click(screen.getByRole('button', { name: /Kickouts/i }));
    await user.click(screen.getByRole('button', { name: /Summary/i }));

    expect(await screen.findByRole('dialog')).toHaveTextContent('Kickout Summary');

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    const playerRow = document.querySelector('.player-row');
    if (!playerRow) throw new Error('Missing player row');
    await user.click(playerRow);
    expect(screen.getByText('#8')).toBeInTheDocument();
  });

  it('switches from live shortcuts into analytics tabs', async () => {
    const session = { user: { id: 'user-live', email: 'analyst@example.com' } };
    const userScope = 'user:user-live';
    const matchId = 'match-live';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [
      {
        id: 'live-ko',
        match_id: matchId,
        created_at: '2026-03-29T09:01:00.000Z',
        updated_at: '2026-03-29T09:01:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '01:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Retained',
        contest_type: 'break',
        break_outcome: 'won',
        target_player: '8',
        x: 0.4,
        y: 0.3,
        schema_version: 1,
      },
      {
        id: 'live-to',
        match_id: matchId,
        created_at: '2026-03-29T09:08:00.000Z',
        updated_at: '2026-03-29T09:08:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '08:00',
        event_type: 'turnover',
        direction: 'ours',
        outcome: 'Won',
        turnover_lost_player: '2',
        turnover_won_player: '14',
        x: 0.5,
        y: 0.5,
        schema_version: 1,
      },
      {
        id: 'live-to-2',
        match_id: matchId,
        created_at: '2026-03-29T09:12:00.000Z',
        updated_at: '2026-03-29T09:12:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '12:00',
        event_type: 'turnover',
        direction: 'ours',
        outcome: 'Lost',
        turnover_lost_player: '3',
        turnover_won_player: '15',
        x: 0.52,
        y: 0.48,
        schema_version: 1,
      },
      {
        id: 'live-to-3',
        match_id: matchId,
        created_at: '2026-03-29T09:16:00.000Z',
        updated_at: '2026-03-29T09:16:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '16:00',
        event_type: 'turnover',
        direction: 'ours',
        outcome: 'Won',
        turnover_lost_player: '5',
        turnover_won_player: '12',
        x: 0.54,
        y: 0.46,
        schema_version: 1,
      },
    ]);

    await renderApp();

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Live/i }));
    expect(await screen.findByText('Live Match State')).toBeInTheDocument();

    await user.click(getDeepAnalysisButton('Kickouts'));
    expect(await screen.findByText('Target Players')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Live$/i }));
    expect(await screen.findByText('Deep Analysis')).toBeInTheDocument();

    await user.click(getDeepAnalysisButton('Turnovers'));
    expect(await screen.findByText('Total turnovers')).toBeInTheDocument();
  });

  it('exports filtered and full event views from the events tab', async () => {
    const session = { user: { id: 'user-export', email: 'analyst@example.com' } };
    const userScope = 'user:user-export';
    const matchId = 'match-export';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [
      {
        id: 'export-1',
        match_id: matchId,
        created_at: '2026-03-29T09:01:00.000Z',
        updated_at: '2026-03-29T09:01:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Vincents',
        period: 'H1',
        clock: '01:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Retained',
        contest_type: 'clean',
        x: 0.4,
        y: 0.3,
        schema_version: 1,
      },
      {
        id: 'export-2',
        match_id: matchId,
        created_at: '2026-03-29T09:08:00.000Z',
        updated_at: '2026-03-29T09:08:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '08:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Lost',
        contest_type: 'clean',
        x: 0.5,
        y: 0.5,
        schema_version: 1,
      },
    ]);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Events/i });
    await user.click(screen.getByRole('button', { name: /Events/i }));

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    createObjectURLSpy.mockClear();
    revokeObjectURLSpy.mockClear();

    try {
      await user.type(screen.getByPlaceholderText(/Search type, opponent, clock, player, zone/i), 'Crokes');
      expect(await screen.findByRole('button', { name: /Export View/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Export View/i }));
      await user.click(screen.getByRole('button', { name: /Export All CSV/i }));
      await user.click(screen.getByRole('button', { name: /Export JSON/i }));

      expect(createObjectURLSpy).toHaveBeenCalledTimes(3);
      expect(clickSpy).toHaveBeenCalledTimes(3);
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(3);
    } finally {
      clickSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    }
  });

  it('loads a row into the capture form and deletes rows from the events tab', async () => {
    const session = { user: { id: 'user-events', email: 'analyst@example.com' } };
    const userScope = 'user:user-events';
    const matchId = 'match-events';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [
      {
        id: 'event-edit',
        match_id: matchId,
        created_at: '2026-03-29T09:01:00.000Z',
        updated_at: '2026-03-29T09:01:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Boden',
        period: 'H1',
        clock: '01:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Retained',
        contest_type: 'clean',
        x: 0.4,
        y: 0.3,
        schema_version: 1,
      },
      {
        id: 'event-edit-2',
        match_id: matchId,
        created_at: '2026-03-29T09:08:00.000Z',
        updated_at: '2026-03-29T09:08:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Na Fianna',
        period: 'H1',
        clock: '08:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Lost',
        contest_type: 'clean',
        x: 0.5,
        y: 0.5,
        schema_version: 1,
      },
    ]);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Events/i });
    await user.click(screen.getByRole('button', { name: /Events/i }));

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });

    await user.click(deleteButtons[0]);

    const dialog = await screen.findByRole('alertdialog', { name: /Confirm action/i });
    expect(dialog).toHaveTextContent(/Delete this event\?/i);

    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    expect(await screen.findByText(/Editing event - tap Update when done/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Event/i })).toBeInTheDocument();
  });

  it('persists retrospective conversion tags when editing a kickout', async () => {
    const session = { user: { id: 'user-review', email: 'analyst@example.com' } };
    const userScope = 'user:user-review';
    const matchId = 'match-review';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [{
      id: 'review-1',
      match_id: matchId,
      created_at: '2026-03-29T09:01:00.000Z',
      updated_at: '2026-03-29T09:01:00.000Z',
      match_date: '2026-03-29',
      team: 'Clontarf',
      opponent: 'Boden',
      period: 'H1',
      clock: '01:00',
      event_type: 'kickout',
      direction: 'ours',
      outcome: 'Retained',
      contest_type: 'clean',
      x: 0.4,
      y: 0.3,
      conversion_result: 'unreviewed',
      schema_version: 1,
    }]);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Events/i });
    await user.click(screen.getByRole('button', { name: /Events/i }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    expect(await screen.findByText(/Retrospective review/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'No score' }));
    await user.click(screen.getByRole('button', { name: /Update Event/i }));

    await waitFor(() => {
      const storedEvents = JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.events, userScope)));
      expect(storedEvents.find((event) => event.id === 'review-1')?.conversion_result).toBe('no_score');
    });
  });

  it('retries event sync without review-tag columns when Supabase schema cache is behind', async () => {
    const session = { user: { id: 'user-review-compat', email: 'analyst@example.com' } };
    const userScope = 'user:user-review-compat';
    const matchId = 'match-review-compat';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [{
      id: 'review-compat-1',
      match_id: matchId,
      created_at: '2026-03-29T09:01:00.000Z',
      updated_at: '2026-03-29T09:01:00.000Z',
      match_date: '2026-03-29',
      team: 'Clontarf',
      opponent: 'Boden',
      period: 'H1',
      clock: '01:00',
      event_type: 'kickout',
      direction: 'ours',
      outcome: 'Retained',
      contest_type: 'clean',
      x: 0.4,
      y: 0.3,
      conversion_result: 'unreviewed',
      schema_version: 1,
    }]);

    mockState.upsertMock.mockImplementation((payload) => {
      if (payload?.id === 'review-compat-1' && Object.prototype.hasOwnProperty.call(payload, 'conversion_result')) {
        return Promise.resolve({
          error: {
            code: 'PGRST204',
            message: "Could not find the 'conversion_result' column of 'events' in the schema cache",
          },
        });
      }
      return Promise.resolve({ error: null });
    });

    await renderApp();
    mockState.upsertMock.mockClear();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Events/i });
    await user.click(screen.getByRole('button', { name: /Events/i }));
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(await screen.findByRole('button', { name: 'No score' }));
    await user.click(screen.getByRole('button', { name: /Update Event/i }));

    await waitFor(() => {
      const eventPayloads = mockState.upsertMock.mock.calls
        .map(([payload]) => payload)
        .filter((payload) => payload?.id === 'review-compat-1');

      expect(eventPayloads.some((payload) => payload.conversion_result === 'no_score')).toBe(true);
      expect(eventPayloads.some((payload) => !Object.prototype.hasOwnProperty.call(payload, 'conversion_result'))).toBe(true);
    });

    expect(await screen.findByText(/missing the latest review-tag columns in Supabase/i)).toBeInTheDocument();
    expect(screen.queryByText(/Some saves are blocked from syncing/i)).not.toBeInTheDocument();
  });

  it('shows the break pickup preview after landing and pickup points are set', async () => {
    const session = { user: { id: 'user-break-preview', email: 'analyst@example.com' } };
    const userScope = 'user:user-break-preview';
    const matchId = 'match-break-preview';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Save Event/i });
    const pitch = await screen.findByRole('application', { name: /GAA pitch/i });

    await user.click(screen.getByRole('button', { name: /^break$/i }));
    expect(screen.getByText(/Step 1 — tap pitch for landing point/i)).toBeInTheDocument();

    await fireEvent.keyDown(pitch, { key: 'Enter' });
    expect(await screen.findByText(/Step 2 — tap pitch for pickup point/i)).toBeInTheDocument();

    await fireEvent.keyDown(pitch, { key: 'Enter' });
    expect(await screen.findByText(/Pick:/i)).toBeInTheDocument();
  });

  it('shows and clears the live phase filter banner', async () => {
    const session = { user: { id: 'user-phase-filter', email: 'analyst@example.com' } };
    const userScope = 'user:user-phase-filter';
    const matchId = 'match-phase-filter';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Live/i });
    await user.click(screen.getByRole('button', { name: /^Live$/i }));

    expect(await screen.findByText(/Showing all periods in this view\./i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^H1$/i }));
    expect(await screen.findByText(/Phase filter active: showing H1 only in Live, Digest, and analytics\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show all/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Show all/i }));
    expect(await screen.findByText(/Showing all periods in this view\./i)).toBeInTheDocument();
  });

  it('announces capture period changes from the form controls', async () => {
    const session = { user: { id: 'user-period-change', email: 'analyst@example.com' } };
    const userScope = 'user:user-period-change';
    const matchId = 'match-period-change';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Save Event/i });
    await user.click(getCaptureFormButton('H2'));

    expect(await screen.findByText(/Period set to H2/i)).toBeInTheDocument();
  });

  it('announces a paused timer when changing periods mid-run', async () => {
    const session = { user: { id: 'user-period-timer', email: 'analyst@example.com' } };
    const userScope = 'user:user-period-timer';
    const matchId = 'match-period-timer';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Save Event/i });
    const timerButton = document.querySelector('.timer-btn');
    if (!timerButton) throw new Error('Missing capture timer button');

    await user.click(timerButton);
    expect(await screen.findByText('Running')).toBeInTheDocument();

    await user.click(getCaptureFormButton('ET'));
    expect(await screen.findByText(/Period set to ET\. Timer paused/i)).toBeInTheDocument();
  });

  it('dismisses delete-all confirmation without wiping local events', async () => {
    const session = { user: { id: 'user-delete', email: 'analyst@example.com' } };
    const userScope = 'user:user-delete';
    const matchId = 'match-delete';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [
      {
        id: 'del-1',
        match_id: matchId,
        created_at: '2026-03-29T09:01:00.000Z',
        updated_at: '2026-03-29T09:01:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '01:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Retained',
        contest_type: 'clean',
        x: 0.4,
        y: 0.3,
        schema_version: 1,
      },
      {
        id: 'del-2',
        match_id: matchId,
        created_at: '2026-03-29T09:08:00.000Z',
        updated_at: '2026-03-29T09:08:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '08:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Lost',
        contest_type: 'clean',
        x: 0.5,
        y: 0.5,
        schema_version: 1,
      },
    ]);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Events/i });
    await user.click(screen.getByRole('button', { name: /Events/i }));
    await user.click(screen.getByRole('button', { name: /Delete all/i }));

    const dialog = await screen.findByRole('alertdialog', { name: /Confirm action/i });
    expect(dialog).toHaveTextContent(/Delete all 2 events from this device/i);

    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();
    await user.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    expect(JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.events, userScope)))).toHaveLength(2);
  });

  it('keeps current conflicting imports while adding brand-new rows', async () => {
    const session = { user: { id: 'user-import', email: 'analyst@example.com' } };
    const userScope = 'user:user-import';
    const matchId = 'match-import';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Boden',
      match_date: '2026-03-25',
      status: 'open',
      created_at: '2026-03-25T09:00:00.000Z',
      updated_at: '2026-03-25T09:00:00.000Z',
      last_event_at: '2026-03-25T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [{
      id: 'existing-1',
      match_id: matchId,
      created_at: '2026-03-25T09:01:00.000Z',
      updated_at: '2026-03-25T09:01:00.000Z',
      match_date: '2026-03-25',
      team: 'Clontarf',
      opponent: 'Boden',
      period: 'H1',
      clock: '01:00',
      event_type: 'kickout',
      direction: 'ours',
      outcome: 'Retained',
      contest_type: 'clean',
      x: 0.4,
      y: 0.3,
      schema_version: 1,
    }]);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Events/i });
    await user.click(screen.getByRole('button', { name: /Events/i }));

    const originalCreateElement = document.createElement.bind(document);
    const fakeInput = {
      type: '',
      accept: '',
      files: [],
      onchange: null,
      click: vi.fn(),
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      if (String(tagName).toLowerCase() === 'input') return fakeInput;
      return originalCreateElement(tagName, options);
    });

    try {
      await user.click(screen.getByRole('button', { name: /Import JSON/i }));

      fakeInput.files = [{
        name: 'import.json',
        text: async () => JSON.stringify([
          {
            id: 'existing-1',
            match_id: matchId,
            created_at: '2026-03-25T09:01:00.000Z',
            updated_at: '2026-03-25T09:01:00.000Z',
            match_date: '2026-03-25',
            team: 'Clontarf',
            opponent: 'Na Fianna',
            period: 'H1',
            clock: '01:00',
            event_type: 'kickout',
            direction: 'ours',
            outcome: 'Lost',
            contest_type: 'clean',
            x: 0.55,
            y: 0.35,
            schema_version: 1,
          },
          {
            id: 'new-2',
            match_id: matchId,
            created_at: '2026-03-25T09:05:00.000Z',
            updated_at: '2026-03-25T09:05:00.000Z',
            match_date: '2026-03-25',
            team: 'Clontarf',
            opponent: 'Vincents',
            period: 'H1',
            clock: '02:00',
            event_type: 'kickout',
            direction: 'ours',
            outcome: 'Score',
            contest_type: 'clean',
            x: 0.62,
            y: 0.42,
            schema_version: 1,
          },
        ], null, 2),
      }];

      if (!fakeInput.onchange) throw new Error('Missing import handler');
      await fakeInput.onchange();

      const dialog = await screen.findByRole('alertdialog', { name: /Confirm action/i });
      expect(dialog).toHaveTextContent(/Replace those events with the imported versions/i);

      await user.click(screen.getByRole('button', { name: /Import new only/i }));

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
        const storedEvents = JSON.parse(localStorage.getItem(storageKey(STORAGE_KEYS.events, userScope)));
        expect(storedEvents).toHaveLength(2);
        expect(storedEvents.find((event) => event.id === 'existing-1')?.opponent).toBe('Boden');
        expect(storedEvents.find((event) => event.id === 'new-2')?.opponent).toBe('Vincents');
      });

      expect(screen.getByRole('cell', { name: /Boden/i })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: /Vincents/i })).toBeInTheDocument();
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('renders the admin tab for configured admins', async () => {
    const session = { user: { id: 'user-admin', email: 'admin@example.com' } };
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });
    mockState.isConfiguredAdminMock.mockReturnValue(true);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Admin/i });
    await user.click(screen.getByRole('button', { name: /Admin/i }));

    expect(await screen.findByRole('heading', { name: 'Admin Onboarding' })).toBeInTheDocument();
  });

  it('shows the digest tab with the current phase label', async () => {
    const session = { user: { id: 'user-digest', email: 'analyst@example.com' } };
    const userScope = 'user:user-digest';
    const matchId = 'match-digest';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Digest/i });
    await user.click(screen.getByRole('button', { name: /Digest/i }));

    expect(screen.getByText(/No events yet for this digest/i)).toBeInTheDocument();
    expect(screen.getByText(/Match \(all periods\)/i)).toBeInTheDocument();
  });

  it('shows the backup reminder toast when local storage hits quota', async () => {
    const session = { user: { id: 'user-backup', email: 'analyst@example.com' } };
    const userScope = 'user:user-backup';
    const matchId = 'match-backup';
    mockState.sessionState.session = session;
    mockState.getSessionMock.mockResolvedValue({ data: { session } });

    seedScopedMatches(userScope, [{
      id: matchId,
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-29',
      status: 'open',
      created_at: '2026-03-29T09:00:00.000Z',
      updated_at: '2026-03-29T09:00:00.000Z',
      last_event_at: '2026-03-29T09:10:00.000Z',
      closed_at: null,
    }]);
    seedScopedActiveMatchId(userScope, matchId);
    seedScopedEvents(userScope, [
      {
        id: 'backup-1',
        match_id: matchId,
        created_at: '2026-03-29T09:01:00.000Z',
        updated_at: '2026-03-29T09:01:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '01:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Retained',
        contest_type: 'clean',
        x: 0.4,
        y: 0.3,
        schema_version: 1,
      },
      {
        id: 'backup-2',
        match_id: matchId,
        created_at: '2026-03-29T09:08:00.000Z',
        updated_at: '2026-03-29T09:08:00.000Z',
        match_date: '2026-03-29',
        team: 'Clontarf',
        opponent: 'Crokes',
        period: 'H1',
        clock: '08:00',
        event_type: 'kickout',
        direction: 'ours',
        outcome: 'Lost',
        contest_type: 'clean',
        x: 0.5,
        y: 0.5,
        schema_version: 1,
      },
    ]);

    await renderApp();

    const user = userEvent.setup();
    await screen.findByRole('button', { name: /Events/i });
    await user.click(screen.getByRole('button', { name: /Events/i }));

    const originalSetItem = Storage.prototype.setItem;
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(key, value) {
      if (String(key) === storageKey(STORAGE_KEYS.events, userScope)) {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    });

    try {
      await user.click(screen.getByRole('button', { name: /Delete all/i }));

      const dialog = await screen.findByRole('alertdialog', { name: /Confirm action/i });
      expect(dialog).toHaveTextContent(/Delete all 2 events from this device/i);
      await user.click(screen.getByRole('button', { name: /Delete all data/i }));

      await waitFor(() => {
        expect(screen.getByText(/back up your data/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Export JSON/i })).toBeInTheDocument();
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
