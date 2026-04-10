import { render, screen } from '@testing-library/svelte';
import { beforeAll, describe, expect, it } from 'vitest';
import Heatmap from '../../src/lib/Heatmap.svelte';

// jsdom does not implement canvas 2D rendering. Provide a minimal stub so
// that Heatmap's draw() function doesn't throw when it calls getContext('2d').
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => ({
    setTransform() {},
    clearRect() {},
    fillRect() {},
    get fillStyle() { return ''; },
    set fillStyle(_v) {},
  });
});

function renderHeatmap(props = {}) {
  return render(Heatmap, { props });
}

describe('Heatmap', () => {
  it('mounts without error when no points are provided', () => {
    expect(() => renderHeatmap()).not.toThrow();
  });

  it('renders the underlying pitch SVG', () => {
    renderHeatmap({ points: [] });
    expect(document.querySelector('svg')).not.toBeNull();
  });

  it('shows no legend when the points array is empty', () => {
    renderHeatmap({ points: [] });
    expect(document.querySelector('.legend')).toBeNull();
  });

  it('shows a density legend (Few / Many) for the default colorScheme', () => {
    renderHeatmap({ points: [{ x: 0.5, y: 0.5 }] });
    expect(screen.getByText('Few')).toBeInTheDocument();
    expect(screen.getByText('Many')).toBeInTheDocument();
  });

  it('shows a density legend for colorScheme="positive"', () => {
    renderHeatmap({ points: [{ x: 0.5, y: 0.5 }], colorScheme: 'positive' });
    expect(screen.getByText('Few')).toBeInTheDocument();
    expect(screen.getByText('Many')).toBeInTheDocument();
    expect(document.querySelector('.legend-bar.positive')).not.toBeNull();
  });

  it('shows a density legend for colorScheme="negative"', () => {
    renderHeatmap({ points: [{ x: 0.5, y: 0.5 }], colorScheme: 'negative' });
    expect(document.querySelector('.legend-bar.negative')).not.toBeNull();
  });

  it('shows a Lost / Won legend for colorScheme="outcome"', () => {
    renderHeatmap({ points: [{ x: 0.5, y: 0.5, outcome: 'won' }], colorScheme: 'outcome' });
    expect(screen.getByText('Lost')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
    expect(document.querySelector('.legend-bar.outcome')).not.toBeNull();
  });

  it('renders the canvas overlay element', () => {
    const { container } = renderHeatmap({ points: [{ x: 0.3, y: 0.4 }] });
    expect(container.querySelector('canvas.overlay')).not.toBeNull();
  });

  it('does not throw when points contain NaN coordinates', () => {
    expect(() =>
      renderHeatmap({ points: [{ x: NaN, y: NaN }, { x: 0.5, y: 0.5 }] })
    ).not.toThrow();
  });

  it('does not throw when points array contains null entries', () => {
    expect(() =>
      renderHeatmap({ points: [null, undefined, { x: 0.5, y: 0.5 }] })
    ).not.toThrow();
  });

  it('hides the legend when points is updated to empty', async () => {
    const { rerender } = renderHeatmap({ points: [{ x: 0.5, y: 0.5 }] });
    expect(document.querySelector('.legend')).not.toBeNull();

    await rerender({ points: [] });
    expect(document.querySelector('.legend')).toBeNull();
  });
});
