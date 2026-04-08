import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SummaryModal from '../../src/lib/SummaryModal.svelte';

const summaryStats = {
  total: 12,
  retPct: 58,
  brTotal: 4,
  brPct: 50,
  h1: { total: 6, retPct: 67 },
  h2: { total: 6, retPct: 50 },
  best: 'R-M',
  worst: 'L-S',
  topPlayer: { label: '#8', total: 4, retPct: 75 },
};

describe('SummaryModal', () => {
  it('frames the modal explicitly as a kickout summary', () => {
    const onClose = vi.fn();
    render(SummaryModal, {
      props: {
        summaryStats,
        title: 'Filtered Kickout Summary',
        subtitle: '12 kickouts in the current filtered view',
      },
      events: { close: onClose },
    });

    expect(screen.getByText('Filtered Kickout Summary')).toBeInTheDocument();
    expect(screen.getByText('Kickout Retention')).toBeInTheDocument();
    expect(screen.getByText(/Most targeted kickout option/i)).toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: 'Filtered Kickout Summary' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
