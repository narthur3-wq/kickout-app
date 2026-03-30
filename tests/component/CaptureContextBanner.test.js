import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMatch, MATCH_KEYS } from '../../src/lib/matchStore.js';
import { LOCAL_STORAGE_SCOPE, storageKey } from '../../src/lib/storageScope.js';

vi.mock('../../src/lib/supabase.js', () => ({
  supabaseConfigured: false,
  supabase: null,
  userHasAccess: vi.fn(),
  getUserTeamDetails: vi.fn(),
  isConfiguredAdmin: vi.fn(),
}));

vi.mock('../../src/lib/diagnostics.js', () => ({
  appendDiagnostic: vi.fn(() => []),
  loadDiagnostics: vi.fn(() => []),
  clearDiagnostics: vi.fn(),
  formatDiagnostics: vi.fn(() => ''),
}));

async function renderApp() {
  const { default: App } = await import('../../src/App.svelte');
  return render(App);
}

function seedScopedMatches(scope, matches) {
  localStorage.setItem(storageKey(MATCH_KEYS.matches, scope), JSON.stringify(matches));
}

function seedScopedActiveMatchId(scope, id) {
  localStorage.setItem(storageKey(MATCH_KEYS.activeMatchId, scope), id);
}

describe('Capture context banner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows a fallback prompt when the active match has no team details yet', async () => {
    const blankMatch = createMatch({
      id: 'match-blank',
      team: '',
      opponent: '',
      match_date: '2026-03-29',
    });

    seedScopedMatches(LOCAL_STORAGE_SCOPE, [blankMatch]);
    seedScopedActiveMatchId(LOCAL_STORAGE_SCOPE, blankMatch.id);

    await renderApp();

    expect(await screen.findByRole('button', { name: /Tap to set match details/i })).toBeInTheDocument();
  });
});
