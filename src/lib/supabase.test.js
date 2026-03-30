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

describe('userHasAccess network failure behaviour', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns false when Supabase returns an auth-level error (user not in allowlist)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }));

    const { userHasAccess } = await import('./supabase.js');
    // data is an empty array — user is not in allowed_users
    expect(await userHasAccess()).toBe(false);
  });

  it('fails open (returns true) when a network exception is thrown during the access check', async () => {
    // This prevents a transient mobile signal drop from signing an analyst out
    // mid-match. The authoritative gate is the next successful round-trip.
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-key');

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        from: () => ({
          select: () => ({
            limit: () => Promise.reject(new Error('Network error')),
          }),
        }),
      }),
    }));

    const { userHasAccess } = await import('./supabase.js');
    expect(await userHasAccess()).toBe(true);
  });
});
