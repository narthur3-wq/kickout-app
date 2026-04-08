import { describe, expect, it } from 'vitest';
import { runWithoutBrowserLock, shouldBypassBrowserAuthLock } from './supabaseAuthLock.js';

const fakeLockManager = /** @type {LockManager} */ ({
  query: async () => ({ held: [], pending: [] }),
  request: async (_name, _options, callback) => callback(null),
});

describe('shouldBypassBrowserAuthLock', () => {
  it('bypasses browser locks on iPadOS devices that present as Mac touch browsers', () => {
    expect(shouldBypassBrowserAuthLock(/** @type {any} */ ({
      navigator: {
        locks: fakeLockManager,
        platform: 'MacIntel',
        maxTouchPoints: 5,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
      },
    }))).toBe(true);
  });

  it('keeps browser locks enabled on desktop Safari', () => {
    expect(shouldBypassBrowserAuthLock(/** @type {any} */ ({
      navigator: {
        locks: fakeLockManager,
        platform: 'MacIntel',
        maxTouchPoints: 0,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
      },
    }))).toBe(false);
  });
});

describe('runWithoutBrowserLock', () => {
  it('runs the callback immediately', async () => {
    await expect(runWithoutBrowserLock('lock:sb', 5000, async () => 'ok')).resolves.toBe('ok');
  });
});
