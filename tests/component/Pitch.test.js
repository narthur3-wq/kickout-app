import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Pitch from '../../src/lib/Pitch.svelte';

function renderPitch(props = {}, events = {}) {
  return render(Pitch, {
    props: {
      contestType: 'clean',
      landing: { x: Number.NaN, y: Number.NaN },
      pickup: { x: Number.NaN, y: Number.NaN },
      overlays: [],
      ...props,
    },
    events,
  });
}

describe('Pitch', () => {
  it('resets the break capture step when the reset token changes', async () => {
    const onLanded = vi.fn();
    const onPicked = vi.fn();
    const { rerender } = renderPitch(
      { contestType: 'break', resetToken: 0 },
      { landed: onLanded, picked: onPicked }
    );

    const pitch = screen.getByRole('application', { name: /GAA pitch/i });

    await fireEvent.keyDown(pitch, { key: 'Enter' });
    expect(onLanded).toHaveBeenCalledTimes(1);
    expect(onPicked).toHaveBeenCalledTimes(0);

    await rerender({
      contestType: 'break',
      landing: { x: Number.NaN, y: Number.NaN },
      pickup: { x: Number.NaN, y: Number.NaN },
      overlays: [],
      resetToken: 1,
    });

    await fireEvent.keyDown(pitch, { key: 'Enter' });
    expect(onLanded).toHaveBeenCalledTimes(2);
    expect(onPicked).toHaveBeenCalledTimes(0);
  });

  it('renders zone labels plus target and goal-attempt rings when requested', () => {
    const { container } = renderPitch({
      showZoneLabels: true,
      overlays: [
        { id: 'target', x: 0.2, y: 0.3, outcome: 'Retained', marker_shape: 'circle', marker_fill: '#16a34a', marker_ring: 'target' },
        { id: 'goal-attempt', x: 0.4, y: 0.6, outcome: 'Goal', marker_shape: 'square', marker_fill: '#15803d', marker_ring: 'goal-attempt' },
      ],
    });

    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
    expect(container.querySelector('circle[stroke-dasharray="1.6 1.2"]')).not.toBeNull();
    expect(container.querySelector('circle[stroke-width="0.9"]')).not.toBeNull();
  });

  it('keeps the 40m and D markings anchored to each goal line', () => {
    const { container } = renderPitch();

    expect(container.querySelector('circle[data-marking="40-left"][cx="0"]')).not.toBeNull();
    expect(container.querySelector('circle[data-marking="40-right"][cx="145"]')).not.toBeNull();
    expect(container.querySelector('circle[data-marking="d-left"][cx="20"][r="13"]')).not.toBeNull();
    expect(container.querySelector('circle[data-marking="d-right"][cx="125"][r="13"]')).not.toBeNull();
    expect(container.querySelectorAll('circle[data-marking]').length).toBe(4);

    const clipRects = Array.from(container.querySelectorAll('defs rect'));
    expect(clipRects).toHaveLength(3);
    expect(clipRects[1].getAttribute('x')).toBe('20');
    expect(clipRects[2].getAttribute('x')).toBe('0');
  });

  it('moves the highlighted goal band when the pitch is flipped', async () => {
    const { container, rerender } = renderPitch({ flip: false });

    let goalBand = container.querySelector('line[stroke="#c41230"]');
    expect(goalBand?.getAttribute('x1')).toBe('0');

    await rerender({
      contestType: 'clean',
      landing: { x: Number.NaN, y: Number.NaN },
      pickup: { x: Number.NaN, y: Number.NaN },
      overlays: [],
      flip: true,
    });

    goalBand = container.querySelector('line[stroke="#c41230"]');
    expect(goalBand?.getAttribute('x1')).toBe('145');
  });
});
