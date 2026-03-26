import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CaptureForm from '../../src/lib/CaptureForm.svelte';

function renderForm(props = {}) {
  return render(CaptureForm, {
    props: {
      team: 'Clontarf',
      opponent: 'Vincents',
      CONTESTS: ['clean', 'break', 'foul', 'out'],
      BREAK_OUTS: ['won', 'lost', 'neutral'],
      undoStack: [],
      ...props,
    },
  });
}

describe('CaptureForm', () => {
  it('shows shot-type controls only for wide or blocked shots', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /shot/i }));
    await user.click(screen.getByRole('button', { name: 'Wide' }));

    expect(screen.getByText(/Goal attempt\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Point' }));

    expect(screen.queryByText(/Goal attempt\?/i)).not.toBeInTheDocument();
  });

  it('dispatches a period change event when the analyst switches phase', async () => {
    const user = userEvent.setup();
    const onPeriodChange = vi.fn();
    render(CaptureForm, {
      props: {
        team: 'Clontarf',
        opponent: 'Vincents',
        CONTESTS: ['clean', 'break', 'foul', 'out'],
        BREAK_OUTS: ['won', 'lost', 'neutral'],
        undoStack: [],
      },
      events: {
        periodChange: onPeriodChange,
      },
    });

    await user.click(screen.getByRole('button', { name: 'H2' }));

    expect(onPeriodChange).toHaveBeenCalledWith(expect.objectContaining({ detail: 'H2' }));
  });

  it('shows cancel controls while editing and keeps undo disabled with no history', () => {
    renderForm({ editingId: 'event-1', undoStack: [] });

    expect(screen.getByText(/Editing event/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear points/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo last change/i })).toBeDisabled();
  });

  it('labels team ownership clearly without implying pitch direction', () => {
    renderForm();

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText(/Choose the team for this event/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clontarf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vincents' })).toBeInTheDocument();
  });

  it('updates the custom jersey label as the analyst types', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText('16+'), '23');

    expect(screen.getByText(/Target player - #23/i)).toBeInTheDocument();
  });

  it('shows turnover winner and loser inputs instead of the target-player grid', async () => {
    const user = userEvent.setup();
    renderForm({
      outcome: 'Won',
      turnoverLostTeam: 'Vincents',
      turnoverWonTeam: 'Clontarf',
    });

    await user.click(screen.getByRole('button', { name: /turnover/i }));

    expect(screen.getByText(/Record who lost the ball and who won it/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Lost by \(Vincents\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Won by \(Clontarf\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Target player/i)).not.toBeInTheDocument();
  });
});
