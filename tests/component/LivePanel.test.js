import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LivePanel from '../../src/lib/LivePanel.svelte';
import { buildSimulatedMatchState } from '../fixtures/simulatedMatch.js';

describe('LivePanel', () => {
  it('renders strong live insights for a simulated half', () => {
    const { events } = buildSimulatedMatchState();

    render(LivePanel, {
      props: {
        events,
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        phaseLabel: 'Match (all periods)',
      },
    });

    expect(screen.getByText('Live Match State')).toBeInTheDocument();
    expect(screen.getByText('Recent Momentum')).toBeInTheDocument();
    expect(screen.getByText('Most successful target')).toBeInTheDocument();
    expect(screen.getByText('Press #8 on their kickouts')).toBeInTheDocument();
  });

  it('dispatches tab requests from the deep analysis shortcuts', async () => {
    const user = userEvent.setup();
    const { events } = buildSimulatedMatchState();
    const onShowTab = vi.fn();
    render(LivePanel, {
      props: {
        events,
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        phaseLabel: 'Match (all periods)',
      },
      events: {
        showTab: onShowTab,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Shots' }));

    expect(onShowTab).toHaveBeenCalledWith(expect.objectContaining({ detail: 'shots' }));
  });
});
