import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DigestPanel from '../../src/lib/DigestPanel.svelte';
import { buildSimulatedMatchState } from '../fixtures/simulatedMatch.js';

describe('DigestPanel', () => {
  it('shows an empty-state message when there are no events', () => {
    render(DigestPanel, {
      props: {
        events: [],
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        phaseLabel: 'Match (all periods)',
      },
    });

    expect(screen.getByText(/No events yet for this digest/i)).toBeInTheDocument();
  });

  it('renders the coach digest with the main action summary', () => {
    const { events } = buildSimulatedMatchState();

    render(DigestPanel, {
      props: {
        events,
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        phaseLabel: 'Match (all periods)',
      },
    });

    expect(screen.getByText('Coach Digest')).toBeInTheDocument();
    expect(screen.getByText('Top 3 Actions')).toBeInTheDocument();
    expect(screen.getByText('Press #8 on their kickouts')).toBeInTheDocument();
  });
});
