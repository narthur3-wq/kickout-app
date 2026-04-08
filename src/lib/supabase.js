import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY
const e2eOfflineMode = import.meta.env.VITE_E2E_OFFLINE_MODE === 'true'
const adminEmails = String(import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

/** Supabase client — null when env vars are not set (offline-only mode) */
export const supabase = (!e2eOfflineMode && url && key) ? createClient(url, key) : null

/** True when Supabase is configured and network features are available */
export const supabaseConfigured = !e2eOfflineMode && !!(url && key)

/** Client-side convenience only; the Edge Function enforces admin access server-side. */
export function isConfiguredAdmin(email) {
  return adminEmails.includes(String(email || '').trim().toLowerCase())
}

/**
 * Returns the team_id for the currently signed-in user, or null if
 * the user has no team assigned or Supabase is not configured.
 */
export async function getUserTeamId() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('team_id')
      .limit(1)
      .single();
    if (error || !data) return null;
    return data.team_id ?? null;
  } catch {
    return null;
  }
}

export async function getUserTeamDetails() {
  if (!supabase) return { id: null, name: null };
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('team_id, teams(name)')
      .limit(1)
      .single();
    if (error || !data) return { id: null, name: null };
    const team = Array.isArray(data.teams) ? data.teams[0] : data.teams;
    return {
      id: data.team_id ?? null,
      name: team?.name ?? null,
    };
  } catch {
    return { id: null, name: null };
  }
}

/**
 * Returns true if the currently signed-in user's email is in the
 * allowed_users allowlist table.  Returns true unconditionally when
 * Supabase is not configured (offline / dev mode).
 */
export async function userHasAccess() {
  if (!supabase) return true; // offline mode — no gate
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email')
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    // Network error — fail open so a transient connectivity blip (e.g., mobile signal
    // drop mid-match) does not sign the user out. The next successful check will deny
    // access if the user has genuinely been removed from allowed_users.
    return true;
  }
}
