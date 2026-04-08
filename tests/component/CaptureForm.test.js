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
  it('shows shot-type controls only for wide, blocked, or dropped short shots', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /shot/i }));
    await user.click(screen.getByRole('button', { name: 'Dropped short' }));

    expect(screen.getByText(/Goal attempt\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Point$/i }));

    expect(screen.queryByText(/Goal attempt\?/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Point$/i })).toHaveClass('active');
    expect(screen.getByRole('button', { name: /^Point$/i }).querySelector('.seg-selected-indicator')).not.toBeNull();
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
    expect(screen.getByText(/Retrospective review/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Score' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'No score' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unreviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear points/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo last change/i })).toBeDisabled();
  });

  it('shows score source controls only when editing a scored shot', () => {
    renderForm({
      editingId: 'event-1',
      eventType: 'shot',
      outcome: 'Goal',
      scoreSource: 'kickout',
    });

    expect(screen.getByText(/Score source/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kickout' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Turnover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Free' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unreviewed' })).toBeInTheDocument();
  });

  it('labels team ownership clearly without implying pitch direction', () => {
    renderForm();

    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByText(/Choose the team for this event/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Clontarf' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Vincents' })).toHaveLength(2);
  });

  it('shows team names instead of retained/lost for kickout outcomes', () => {
    renderForm();

    expect(screen.getAllByRole('button', { name: 'Clontarf' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Vincents' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Retained' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lost' })).not.toBeInTheDocument();
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
