import { render, screen, within } from '@testing-library/svelte';
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

  it('shows cancel controls while editing and keeps undo disabled with no history', () => {
    renderForm({ editingId: 'event-1', undoStack: [] });

    expect(screen.getByText(/Editing event/i)).toBeInTheDocument();
    expect(screen.getByText(/Retrospective review/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Score' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'No score' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unreviewed' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear points/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Undo last/i })).toBeDisabled();
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

    expect(screen.getByText('Kickout by')).toBeInTheDocument();
    // Scoped to the team row: for a kickout the outcome options are the same
    // two team names, so an unscoped lookup is ambiguous. That ambiguity is a
    // real UX issue in its own right — roadmap item 1.3.
    const teamRow = document.querySelector('.dir-row');
    expect(within(teamRow).getByRole('button', { name: 'Clontarf' })).toBeInTheDocument();
    expect(within(teamRow).getByRole('button', { name: 'Vincents' })).toBeInTheDocument();
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

  describe('kickout team and outcome rows', () => {
    function outcomeButtons() {
      return [...document.querySelectorAll('.outcome-grid button')].map((b) => ({
        label: b.textContent.trim().replace(/\s*On$/, ''),
        retained: b.className.includes('outcome-retained'),
      }));
    }

    it('names the question each row is asking', () => {
      renderForm();

      // "Team" and "Outcome" sat above two identical rows of the same two club
      // names, which is how the wrong row got set under time pressure.
      expect(screen.getByText('Kickout by')).toBeInTheDocument();
      expect(screen.getByText('Won by')).toBeInTheDocument();
    });

    it('keeps the outcome options in the same order whoever kicked', async () => {
      const user = userEvent.setup();
      renderForm();

      expect(outcomeButtons().map((b) => b.label)).toEqual(['Clontarf', 'Vincents']);

      // Switch to the opposition's kickout. The options used to swap places,
      // so the leftmost button changed meaning and an analyst working by
      // position recorded the result backwards.
      const teamRow = document.querySelector('.dir-row');
      await user.click(within(teamRow).getByRole('button', { name: 'Vincents' }));

      expect(outcomeButtons().map((b) => b.label)).toEqual(['Clontarf', 'Vincents']);
    });

    it('colours the kicking team as the retention, whoever kicked', async () => {
      const user = userEvent.setup();
      renderForm();

      // Our kickout: we are the retention.
      expect(outcomeButtons()).toEqual([
        { label: 'Clontarf', retained: true },
        { label: 'Vincents', retained: false },
      ]);

      const teamRow = document.querySelector('.dir-row');
      await user.click(within(teamRow).getByRole('button', { name: 'Vincents' }));

      // Their kickout: they are the retention now. This inverted silently once
      // the option order stopped changing, because the class came from a plain
      // function call the each-block could not see as a dependency.
      expect(outcomeButtons()).toEqual([
        { label: 'Clontarf', retained: false },
        { label: 'Vincents', retained: true },
      ]);
    });

    it('marks the kicking team winning it as the retention', async () => {
      const user = userEvent.setup();
      renderForm();

      const teamRow = document.querySelector('.dir-row');
      await user.click(within(teamRow).getByRole('button', { name: 'Vincents' }));

      const outcomeGrid = () => document.querySelector('.outcome-grid');
      await user.click(within(outcomeGrid()).getByRole('button', { name: 'Vincents' }));
      let active = outcomeGrid().querySelector('.active');
      expect(active.textContent).toContain('Vincents');
      expect(active.className).toContain('outcome-retained');

      await user.click(within(outcomeGrid()).getByRole('button', { name: 'Clontarf' }));
      active = outcomeGrid().querySelector('.active');
      expect(active.textContent).toContain('Clontarf');
      expect(active.className).toContain('outcome-lost');
    });
  });
});
