import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

    seedScopedMeta('user:user-2', {
      team: 'Clontarf',
      opponent: 'Crokes',
      match_date: '2026-03-25',
      period: 'H1',
      our_goal_at_top: true,
    });

    await renderApp();

    expect(await screen.findByText(/cloud sync is paused/i)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Save Event/i }));

    expect(await screen.findByText(/finish onboarding before recording events/i)).toBeInTheDocument();
  });
});
