import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import AnalyticsPanel from '../../src/lib/AnalyticsPanel.svelte';

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({
    setTransform() {},
    clearRect() {},
    fillRect() {},
  }));
});

describe('AnalyticsPanel legends', () => {
  it('renders a kickout dots legend with team, outcome, and target cues', () => {
    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'kickout',
        vizEvents: [
          { id: 'ko-1', event_type: 'kickout', direction: 'ours', outcome: 'Retained', target_player: '8', contest_type: 'clean' },
        ],
        overlays: [
          { id: 'ko-1', x: 0.2, y: 0.3, outcome: 'Retained', marker_shape: 'circle', marker_fill: '#16a34a', marker_ring: 'target' },
        ],
      },
    });

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getAllByText('Ours').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Theirs').length).toBeGreaterThan(0);
    expect(screen.getByText('Successful')).toBeInTheDocument();
    expect(screen.getByText('Lost')).toBeInTheDocument();
    expect(screen.getByText('Dead-ball / foul')).toBeInTheDocument();
    expect(screen.getByText('Targeted player')).toBeInTheDocument();
    expect(screen.getByText('Highlighted end = our goal')).toBeInTheDocument();
    expect(screen.queryByText('Event locations')).not.toBeInTheDocument();
  });

  it('renders richer shot outcome legends and heat labels', async () => {
    const user = userEvent.setup();

    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'shot',
        vizEvents: [
          { id: 's1', event_type: 'shot', direction: 'ours', outcome: 'Goal', shot_type: 'goal' },
          { id: 's2', event_type: 'shot', direction: 'ours', outcome: 'Point', shot_type: 'point' },
          { id: 's3', event_type: 'shot', direction: 'theirs', outcome: 'Wide', shot_type: 'point' },
        ],
        overlays: [
          { id: 's1', x: 0.2, y: 0.3, outcome: 'Goal', marker_shape: 'circle', marker_fill: '#15803d', marker_ring: 'goal-attempt' },
          { id: 's2', x: 0.3, y: 0.4, outcome: 'Point', marker_shape: 'circle', marker_fill: '#0f766e' },
          { id: 's3', x: 0.5, y: 0.6, outcome: 'Wide', marker_shape: 'square', marker_fill: '#f59e0b' },
        ],
      },
    });

    expect(screen.getByText('Goal')).toBeInTheDocument();
    expect(screen.getByText('Point')).toBeInTheDocument();
    expect(screen.getByText('Wide')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Goal attempt')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Heat' }));
    await user.click(screen.getByRole('button', { name: 'Scored' }));

    expect(screen.getByRole('button', { name: 'Scored' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Missed' })).toBeInTheDocument();
    expect(screen.getByText(/Scored density/i)).toBeInTheDocument();
  });
});
