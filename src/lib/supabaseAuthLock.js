/**
 * iPadOS Safari can advertise desktop-class WebKit while still exposing
 * touch-only browser behavior. Supabase auth operations can stall there when
 * they rely on browser Web Locks, so keep auth locking in-process instead.
 */
export function shouldBypassBrowserAuthLock(browser = globalThis) {
  const navigatorRef = browser?.navigator;
  if (!navigatorRef?.locks) return false;

  const userAgent = String(navigatorRef.userAgent || '');
  const platform = String(navigatorRef.platform || '');
  const maxTouchPoints = Number(navigatorRef.maxTouchPoints || 0);

  return /iPad|iPhone|iPod/.test(userAgent)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export async function runWithoutBrowserLock(_name, _acquireTimeout, fn) {
  return await fn();
}
