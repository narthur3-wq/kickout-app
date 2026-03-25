import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DigestPanel from '../../src/lib/DigestPanel.svelte';
import { buildSimulatedMatchState } from '../fixtures/simulatedMatch.js';

vi.mock('html2canvas', () => ({
  default: vi.fn().mockRejectedValue(new Error('render failed')),
}));

describe('DigestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('shows a visible error if digest image generation fails', async () => {
    const user = userEvent.setup();
    const { events } = buildSimulatedMatchState();

    render(DigestPanel, {
      props: {
        events,
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        phaseLabel: 'Match (all periods)',
      },
    });

    await user.click(screen.getByRole('button', { name: /Share image/i }));

    expect(await screen.findByText(/Could not generate the digest image on this device/i)).toBeInTheDocument();
  });
});
