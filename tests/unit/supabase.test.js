import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => {
  const mockClient = {
    from: vi.fn(),
  };

  return {
    mockClient,
    createClientMock: vi.fn(() => mockClient),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseState.createClientMock,
}));

async function loadSupabaseModule({
  url = '',
  key = '',
  adminEmails = '',
} = {}) {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', key);
  vi.stubEnv('VITE_ADMIN_EMAILS', adminEmails);
  return import('../../src/lib/supabase.js');
}

function mockTeamIdQuery(result) {
  const single = vi.fn().mockResolvedValue(result);
  const limit = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ limit }));
  supabaseState.mockClient.from.mockReturnValue({ select });
  return { select, limit, single };
}

function mockTeamDetailsQuery(result) {
  return mockTeamIdQuery(result);
}

function mockAccessQuery(result) {
  const limit = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ limit }));
  supabaseState.mockClient.from.mockReturnValue({ select });
  return { select, limit };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  supabaseState.createClientMock.mockReturnValue(supabaseState.mockClient);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supabase helpers', () => {
  it('stays offline when the Supabase env vars are missing', async () => {
    const mod = await loadSupabaseModule();

    expect(mod.supabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
    expect(supabaseState.createClientMock).not.toHaveBeenCalled();
    expect(mod.isConfiguredAdmin('admin@example.com')).toBe(false);
    expect(mod.isConfiguredAdmin()).toBe(false);
  });

  it('creates a client and normalizes configured admin emails', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
      adminEmails: 'Admin@Example.com, second@example.com , ',
    });

    expect(supabaseState.createClientMock).toHaveBeenCalledWith(
      'https://project.supabase.co',
      'anon-key',
      undefined
    );
    expect(mod.supabaseConfigured).toBe(true);
    expect(mod.supabase).toBe(supabaseState.mockClient);
    expect(mod.isConfiguredAdmin(' admin@example.com ')).toBe(true);
    expect(mod.isConfiguredAdmin('SECOND@example.com')).toBe(true);
    expect(mod.isConfiguredAdmin('other@example.com')).toBe(false);
  });

  it('returns the current team id when the allowed user lookup succeeds', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
    const chain = mockTeamIdQuery({
      data: { team_id: 'team-1' },
      error: null,
    });

    await expect(mod.getUserTeamId()).resolves.toBe('team-1');
    expect(supabaseState.mockClient.from).toHaveBeenCalledWith('allowed_users');
    expect(chain.select).toHaveBeenCalledWith('team_id');
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(chain.single).toHaveBeenCalled();
  });

  it('falls back to null when the team lookup fails', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
    mockTeamIdQuery({
      data: null,
      error: new Error('not found'),
    });

    await expect(mod.getUserTeamId()).resolves.toBeNull();
  });

  it('returns null when the team record is missing a team_id', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
    mockTeamIdQuery({
      data: {},
      error: null,
    });

    await expect(mod.getUserTeamId()).resolves.toBeNull();
  });

  it('returns null when the team lookup throws', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
    const single = vi.fn().mockRejectedValue(new Error('network down'));
    const limit = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ limit }));
    supabaseState.mockClient.from.mockReturnValue({ select });

    await expect(mod.getUserTeamId()).resolves.toBeNull();
  });

  it('returns team details for both array and object team payloads', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });

    mockTeamDetailsQuery({
      data: {
        team_id: 'team-1',
        teams: [{ name: 'Clontarf' }],
      },
      error: null,
    });
    await expect(mod.getUserTeamDetails()).resolves.toEqual({
      id: 'team-1',
      name: 'Clontarf',
    });

    mockTeamDetailsQuery({
      data: {
        team_id: 'team-2',
        teams: { name: 'Na Fianna' },
      },
      error: null,
    });
    await expect(mod.getUserTeamDetails()).resolves.toEqual({
      id: 'team-2',
      name: 'Na Fianna',
    });
  });

  it('falls back to empty team details when the query throws', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
    const single = vi.fn().mockRejectedValue(new Error('network down'));
    const limit = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ limit }));
    supabaseState.mockClient.from.mockReturnValue({ select });

    await expect(mod.getUserTeamDetails()).resolves.toEqual({ id: null, name: null });
  });

  it('falls back to empty team details when no allowed user row is found', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
    mockTeamDetailsQuery({
      data: null,
      error: null,
    });

    await expect(mod.getUserTeamDetails()).resolves.toEqual({ id: null, name: null });
  });

  it('falls back to empty team details when the payload is incomplete', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });
    mockTeamDetailsQuery({
      data: {
        teams: null,
      },
      error: null,
    });

    await expect(mod.getUserTeamDetails()).resolves.toEqual({ id: null, name: null });
  });

  it('checks access allowlists and fails open on transient errors', async () => {
    const mod = await loadSupabaseModule({
      url: 'https://project.supabase.co',
      key: 'anon-key',
    });

    mockAccessQuery({
      data: [{ email: 'analyst@example.com' }],
      error: null,
    });
    await expect(mod.userHasAccess()).resolves.toBe(true);

    mockAccessQuery({
      data: [],
      error: null,
    });
    await expect(mod.userHasAccess()).resolves.toBe(false);

    mockAccessQuery({
      data: null,
      error: new Error('permission denied'),
    });
    await expect(mod.userHasAccess()).resolves.toBe(false);

    const limit = vi.fn().mockRejectedValue(new Error('offline'));
    const select = vi.fn(() => ({ limit }));
    supabaseState.mockClient.from.mockReturnValue({ select });
    await expect(mod.userHasAccess()).resolves.toBe(true);
  });

  it('returns true for offline access checks even without a configured client', async () => {
    const mod = await loadSupabaseModule();

    await expect(mod.userHasAccess()).resolves.toBe(true);
  });
});
