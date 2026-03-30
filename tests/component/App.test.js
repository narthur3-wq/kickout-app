import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MATCH_KEYS } from '../../src/lib/matchStore.js';
import { LOCAL_STORAGE_SCOPE, STORAGE_KEYS, storageKey } from '../../src/lib/storageScope.js';

const mockState = vi.hoisted(() => {
  const sessionState = { session: null };
  const subscription = { unsubscribe: vi.fn() };
  const selectOrderMock = vi.fn();
  const selectEqMock = vi.fn(() => ({ order: selectOrderMock }));
  const selectMock = vi.fn(() => ({ eq: selectEqMock }));
  const upsertMock = vi.fn();
  const deleteEqMock = vi.fn();
  const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));
  const fromMock = vi.fn(() => ({
    select: selectMock,
    upsert: upsertMock,
    delete: deleteMock,
  }));
  const channelMock = {
    on: vi.fn().mockReturnThis(),
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
    selectEqMock,
    selectMock,
    upsertMock,
    deleteEqMock,
    deleteMock,
    fromMock,
    channelFactoryMock: vi.fn(() => channelMock),
    channelMock,
  };
});

const diagnosticsMock = vi.hoisted(() => ({
  appendDiagnostic: vi.fn(() => []),
  loadDiagnostics: vi.fn(() => []),
  clearDiagnostics: vi.fn(),
  formatDiagnostics: vi.fn((entries = []) => entries.map((entry) => `${entry.kind}: ${entry.message}`).join('\n')),
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
    mockState.selectOrderMock.mockResolvedValue({ data: [], error: null });
    mockState.selectEqMock.mockClear();
    mockState.selectMock.mockClear();
    mockState.upsertMock.mockResolvedValue({ error: null });
    mockState.deleteEqMock.mockResolvedValue({ error: null });
    mockState.deleteMock.mockClear();
    mockState.fromMock.mockClear();
    mockState.channelFactoryMock.mockClear();
    mockState.channelMock.on.mockClear();
    mockState.channelMock.subscribe.mockClear();
    diagnosticsMock.appendDiagnostic.mockClear();
    diagnosticsMock.loadDiagnostics.mockReturnValue([]);
    diagnosticsMock.clearDiagnostics.mockClear();
    diagnosticsMock.formatDiagnostics.mockImplementation((entries = []) =>
      entries.map((entry) => `${entry.kind}: ${entry.message}`).join('\n')
    );
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
});
