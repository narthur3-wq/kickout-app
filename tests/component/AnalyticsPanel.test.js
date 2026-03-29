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
  it('shows a resettable empty state when filters remove all events', async () => {
    const user = userEvent.setup();

    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'kickout',
        vizEvents: [],
        periodFilter: 'H1',
        oppFilter: 'crokes',
        ytdOnly: true,
      },
    });

    expect(screen.getByText(/No Kickouts logged yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Reset filters/i }));
    expect(screen.getByText(/Adjust or clear your filters to see data/i)).toBeInTheDocument();
  });

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

  it('shows kickout-only controls like Summary and the small-sample notice', () => {
    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'kickout',
        vizEvents: [
          { id: 'ko-1', event_type: 'kickout', direction: 'ours', outcome: 'Retained' },
          { id: 'ko-2', event_type: 'kickout', direction: 'theirs', outcome: 'Lost' },
        ],
        overlays: [
          { id: 'ko-1', x: 0.2, y: 0.3, outcome: 'Retained', marker_shape: 'circle', marker_fill: '#16a34a' },
          { id: 'ko-2', x: 0.4, y: 0.5, outcome: 'Lost', marker_shape: 'square', marker_fill: '#dc2626' },
        ],
      },
    });

    expect(screen.getByRole('button', { name: /Summary/i })).toBeInTheDocument();
    expect(screen.getByText(/small sample/i)).toBeInTheDocument();
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

  it('renders the shot headline summary and omits the kickout summary button', () => {
    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'shot',
        vizEvents: [
          { id: 's1', event_type: 'shot', direction: 'ours', outcome: 'Goal', shot_type: 'goal' },
          { id: 's2', event_type: 'shot', direction: 'ours', outcome: 'Point', shot_type: 'point' },
          { id: 's3', event_type: 'shot', direction: 'theirs', outcome: 'Wide', shot_type: 'point' },
          { id: 's4', event_type: 'shot', direction: 'theirs', outcome: 'Saved', shot_type: 'goal' },
        ],
      },
    });

    expect(screen.getByText('Total shots')).toBeInTheDocument();
    expect(screen.getByText('Goal chances / scored')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Summary/i })).not.toBeInTheDocument();
  });

  it('shows kickout landing and pickup toggles plus kickout heat labels when break events exist', async () => {
    const user = userEvent.setup();

    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'kickout',
        vizEvents: [
          { id: 'k1', event_type: 'kickout', direction: 'ours', outcome: 'Retained', contest_type: 'break', target_player: '8' },
        ],
        overlays: [
          { id: 'k1', x: 0.2, y: 0.3, outcome: 'Retained', marker_shape: 'circle', marker_fill: '#16a34a', marker_ring: 'target' },
        ],
      },
    });

    expect(screen.getByRole('button', { name: 'Landing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pickup' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Heat' }));
    expect(screen.getByRole('button', { name: 'Density' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Successful' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lost' })).toBeInTheDocument();
  });

  it('uses won and lost labels for turnover heat maps', async () => {
    const user = userEvent.setup();

    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'turnover',
        vizEvents: [
          { id: 't1', event_type: 'turnover', direction: 'ours', outcome: 'Won' },
          { id: 't2', event_type: 'turnover', direction: 'theirs', outcome: 'Lost' },
        ],
        overlays: [
          { id: 't1', x: 0.2, y: 0.3, outcome: 'Won', marker_shape: 'circle', marker_fill: '#16a34a' },
          { id: 't2', x: 0.4, y: 0.5, outcome: 'Lost', marker_shape: 'square', marker_fill: '#dc2626' },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Heat' }));

    expect(screen.getByRole('button', { name: 'Won' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lost' })).toBeInTheDocument();
    expect(screen.queryByText('Successful')).not.toBeInTheDocument();
  });

  it('renders the turnover headline summary chips', () => {
    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'turnover',
        vizEvents: [
          { id: 't1', event_type: 'turnover', direction: 'ours', outcome: 'Won' },
          { id: 't2', event_type: 'turnover', direction: 'theirs', outcome: 'Lost' },
          { id: 't3', event_type: 'turnover', direction: 'ours', outcome: 'Won' },
        ],
      },
    });

    expect(screen.getByText('Total turnovers')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
  });

  it('uses the rendered event set to resolve the legend when the incoming tab type is stale', () => {
    render(AnalyticsPanel, {
      props: {
        analyticsEventType: 'shot',
        vizEvents: [
          { id: 'to-1', event_type: 'turnover', direction: 'ours', outcome: 'Won' },
          { id: 'to-2', event_type: 'turnover', direction: 'theirs', outcome: 'Lost' },
        ],
        overlays: [
          { id: 'to-1', x: 0.2, y: 0.3, outcome: 'Won', marker_shape: 'circle', marker_fill: '#16a34a' },
          { id: 'to-2', x: 0.4, y: 0.5, outcome: 'Lost', marker_shape: 'square', marker_fill: '#dc2626' },
        ],
      },
    });

    expect(screen.getByText('Turnovers')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
    expect(screen.getByText('Lost')).toBeInTheDocument();
    expect(screen.queryByText('Goal attempt')).not.toBeInTheDocument();
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
  });
});
