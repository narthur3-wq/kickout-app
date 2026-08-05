import { createClient } from '@supabase/supabase-js';
import { runWithoutBrowserLock, shouldBypassBrowserAuthLock } from './supabaseAuthLock.js';

const supabaseDisabled = import.meta.env.VITE_DISABLE_SUPABASE === '1';
const url = supabaseDisabled ? '' : import.meta.env.VITE_SUPABASE_URL;
const key = supabaseDisabled ? '' : import.meta.env.VITE_SUPABASE_ANON_KEY;
const adminEmails = String(import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const demoEmail = String(import.meta.env.VITE_DEMO_EMAIL || '').trim();
const demoPassword = String(import.meta.env.VITE_DEMO_PASSWORD || '');

/**
 * Shared read/write demo account, surfaced as a one-tap sign-in on the login
 * screen so evaluators do not need to be onboarded first.
 *
 * These credentials ship in the client bundle — that is inherent to a public
 * one-tap demo and is not a leak to be fixed by hiding them better. The
 * containment is Row Level Security: every table is scoped by `auth_team_id()`
 * (see supabase/migrations/20260323000000_team_rls.sql), so the demo account
 * must be assigned its own `teams` row. It can then only ever read or write
 * demo data, never a real club's.
 *
 * Leave the env vars unset to remove the demo button entirely.
 */
export const demoCredentials = (demoEmail && demoPassword)
  ? { email: demoEmail, password: demoPassword }
  : null;

/** True when the given email is the configured demo account. */
export function isDemoAccount(email) {
  if (!demoCredentials) return false;
  return String(email || '').trim().toLowerCase() === demoCredentials.email.toLowerCase();
}

export function getSupabaseClientOptions(browser = globalThis) {
  if (!shouldBypassBrowserAuthLock(browser)) return undefined;

  return {
    auth: {
      lock: runWithoutBrowserLock,
    },
  };
}

/** Supabase client - null when env vars are not set (offline-only mode) */
export const supabase = (url && key) ? createClient(url, key, getSupabaseClientOptions()) : null;

/** True when Supabase is configured and network features are available */
export const supabaseConfigured = !!(url && key);

/** True when a demo account is configured and reachable for this deployment. */
export const demoLoginEnabled = supabaseConfigured && !!demoCredentials;

/** Client-side convenience only; the Edge Function enforces admin access server-side. */
export function isConfiguredAdmin(email) {
  return adminEmails.includes(String(email || '').trim().toLowerCase());
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
 * allowed_users allowlist table. Returns true unconditionally when
 * Supabase is not configured (offline / dev mode).
 */
export async function userHasAccess() {
  if (!supabase) return true; // offline mode - no gate
  try {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email')
      .limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    // Offline-only mode is handled above. When Supabase is configured, a failed
    // access lookup is an unknown authorization state, so keep the user out of
    // the signed-in cloud path until the check can be retried successfully.
    return false;
  }
}
