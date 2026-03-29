import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toast from '../../src/lib/Toast.svelte';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the message immediately and hides after the timeout', async () => {
    render(Toast, { message: 'Saved locally', timeout: 1000 });

    expect(screen.getByText('Saved locally')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1000);

    expect(screen.queryByText('Saved locally')).not.toBeInTheDocument();
  });

  it('resets the hide timer when a new message arrives', async () => {
    const { rerender } = render(Toast, { message: 'Saved locally', timeout: 1000 });

    await vi.advanceTimersByTimeAsync(800);
    await rerender({ message: 'Sync queued', timeout: 1000 });

    expect(screen.getByText('Sync queued')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(800);
    expect(screen.getByText('Sync queued')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(200);
    expect(screen.queryByText('Sync queued')).not.toBeInTheDocument();
  });
});
