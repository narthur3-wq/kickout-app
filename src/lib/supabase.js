import { createClient } from '@supabase/supabase-js'

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY
const adminEmails = String(import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

/** Supabase client — null when env vars are not set (offline-only mode) */
export const supabase = (url && key) ? createClient(url, key) : null

/** True when Supabase is configured and network features are available */
export const supabaseConfigured = !!(url && key)

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
    if (error) {
      // If the table doesn't exist yet (pre-migration env) fail open
      // so existing single-user installs keep working.
      if (error.code === '42P01') return true;
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}
