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

function installSvgPointMocks(svg) {
  Object.defineProperty(svg, 'createSVGPoint', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      matrixTransform() {
        return { x: this.x, y: this.y };
      },
    }),
  });
  Object.defineProperty(svg, 'getScreenCTM', {
    configurable: true,
    value: () => ({
      inverse: () => ({}),
    }),
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
    expect(container.querySelector('circle[stroke="rgba(255,255,255,0.98)"]')).not.toBeNull();
    expect(container.querySelector('circle[stroke-width="2"]')).not.toBeNull();
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

  it('dispatches handle events without falling through to pitch placement', async () => {
    const onHandleClick = vi.fn();
    const onHandleDrag = vi.fn();
    const onLanded = vi.fn();

    renderPitch(
      {
        editHandles: [
          { id: 'release', x: 0.25, y: 0.4, label: 'Drag release point' },
        ],
      },
      { handleclick: onHandleClick, handledrag: onHandleDrag, landed: onLanded }
    );

    const handle = screen.getByRole('button', { name: /Drag release point/i });
    await fireEvent.keyDown(handle, { key: 'ArrowRight' });

    expect(onHandleClick).toHaveBeenCalledTimes(1);
    expect(onHandleDrag).toHaveBeenCalledTimes(1);
    expect(onLanded).not.toHaveBeenCalled();
    expect(onHandleDrag.mock.calls[0][0].detail.id).toBe('release');
    expect(onHandleDrag.mock.calls[0][0].detail.point.x).toBeCloseTo(0.25, 6);
    expect(onHandleDrag.mock.calls[0][0].detail.point.y).toBeCloseTo(0.41, 6);
  });

  it('renders a smooth SVG path for connections with a points array', () => {
    const { container } = renderPitch({
      connections: [
        {
          id: 'carry-smooth',
          points: [{ x: 0.3, y: 0.2 }, { x: 0.5, y: 0.6 }, { x: 0.7, y: 0.4 }],
          color: '#2563eb',
          arrow: true,
          clickable: true,
          label: 'Smooth carry path',
        },
      ],
    });

    // Expects a <path> element (not a <line>) for the smooth render
    const paths = container.querySelectorAll('path[stroke="#2563eb"]');
    expect(paths.length).toBeGreaterThan(0);
    // The path data should start with M and include at least one C (cubic bezier)
    const pathD = paths[0].getAttribute('d') || '';
    expect(pathD).toMatch(/^M\s/);
    expect(pathD).toMatch(/C\s/);
  });

  it('renders a straight line for connections with only from/to (no waypoints)', () => {
    const { container } = renderPitch({
      connections: [
        {
          id: 'ball-path',
          from: { x: 0.3, y: 0.2 },
          to: { x: 0.7, y: 0.8 },
          color: '#16a34a',
          arrow: true,
          label: 'Ball path',
        },
      ],
    });

    const lines = container.querySelectorAll('line[stroke="#16a34a"]');
    expect(lines.length).toBeGreaterThan(0);
  });

  it('updates the dragged handle position from pointer movement', async () => {
    const onHandleClick = vi.fn();
    const onHandleDrag = vi.fn();

    renderPitch(
      {
        editHandles: [
          { id: 'receive', x: 0.2, y: 0.2, label: 'Drag receive point' },
        ],
      },
      { handleclick: onHandleClick, handledrag: onHandleDrag }
    );

    const pitch = screen.getByRole('application', { name: /GAA pitch/i });
    installSvgPointMocks(pitch);

    const handle = screen.getByRole('button', { name: /Drag receive point/i });
    await fireEvent.pointerDown(handle, { clientX: 29, clientY: 18 });
    await fireEvent.pointerMove(window, { clientX: 58, clientY: 18 });
    await fireEvent.pointerUp(window);

    expect(onHandleClick).toHaveBeenCalledTimes(1);
    expect(onHandleDrag).toHaveBeenCalledTimes(1);
    expect(onHandleDrag.mock.calls[0][0].detail.id).toBe('receive');
    expect(onHandleDrag.mock.calls[0][0].detail.point.x).toBeCloseTo(0.2, 6);
    expect(onHandleDrag.mock.calls[0][0].detail.point.y).toBeCloseTo(0.4, 6);
  });
});
