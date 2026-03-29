import { afterEach, describe, expect, it, vi } from 'vitest';

describe('supabase helpers in offline mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('falls back safely when Supabase env vars are not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    vi.stubEnv('VITE_ADMIN_EMAILS', '');

    const { getUserTeamDetails, getUserTeamId, isConfiguredAdmin, supabase, supabaseConfigured, userHasAccess } = await import('./supabase.js');

    expect(supabaseConfigured).toBe(false);
    expect(supabase).toBeNull();
    expect(await getUserTeamId()).toBeNull();
    expect(await getUserTeamDetails()).toEqual({ id: null, name: null });
    expect(await userHasAccess()).toBe(true);
    expect(isConfiguredAdmin('analyst@example.com')).toBe(false);
  });
});
