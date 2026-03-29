import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DigestPanel from '../../src/lib/DigestPanel.svelte';
import { buildSimulatedMatchState } from '../fixtures/simulatedMatch.js';

const html2canvasMock = vi.fn();

vi.mock('html2canvas', () => ({
  default: html2canvasMock,
}));

describe('DigestPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    html2canvasMock.mockRejectedValue(new Error('render failed'));
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

  it('falls back to download when native share is unavailable', async () => {
    const user = userEvent.setup();
    const { events } = buildSimulatedMatchState();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    html2canvasMock.mockResolvedValue({
      toBlob(callback) {
        callback(new Blob(['png'], { type: 'image/png' }));
      },
    });
    navigator.canShare = vi.fn(() => false);

    render(DigestPanel, {
      props: {
        events,
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        phaseLabel: 'Match (all periods)',
      },
    });

    await user.click(screen.getByRole('button', { name: /Share image/i }));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalled();
    expect(screen.queryByText(/Could not generate the digest image on this device/i)).not.toBeInTheDocument();
  });

  it('keeps tactical copy quiet when there is only a tiny sample', () => {
    render(DigestPanel, {
      props: {
        events: [
          {
            id: 'kickout-1',
            created_at: '2026-03-25T12:00:00.000Z',
            match_date: '2026-03-25',
            team: 'Clontarf',
            opponent: 'Vincents',
            period: 'H1',
            clock: '01:00',
            event_type: 'kickout',
            direction: 'ours',
            outcome: 'Retained',
            contest_type: 'clean',
            x: 0.45,
            y: 0.22,
            restart_reason: 'Score',
            schema_version: 1,
          },
        ],
        teamName: 'Clontarf',
        opponentName: 'Vincents',
        phaseLabel: 'Match (all periods)',
      },
    });

    expect(screen.getByText(/Not enough data yet to describe the flow with confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/No strong tactical change yet\. Keep monitoring the half/i)).toBeInTheDocument();
  });
});
