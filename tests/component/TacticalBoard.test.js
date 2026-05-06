import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import TacticalBoard from '../../src/lib/TacticalBoard.svelte';
import { tacticalBoardStorageKey } from '../../src/lib/tacticalBoardUtils.js';

describe('TacticalBoard', () => {
  it('restores a saved board and exposes the MVP coaching controls', async () => {
    localStorage.setItem(tacticalBoardStorageKey('unit-board'), JSON.stringify({
      moves: [
        {
          id: 'shot-1',
          type: 'shot',
          team: 'home',
          playerId: 'home-11',
          target: { x: 0.5, y: 0.98 },
          step: 1,
          createdOrder: 1,
        },
      ],
      penStrokes: [
        {
          id: 'pen-1',
          color: '#facc15',
          width: 2.2,
          step: 1,
          path: [{ x: 0.2, y: 0.2 }, { x: 0.35, y: 0.4 }],
          createdOrder: 2,
        },
      ],
      pitchView: 'left',
      playbackSpeed: 2,
      homeColor: '#16a34a',
      awayColor: '#2563eb',
      markerSize: 'compact',
      showTeamLabels: true,
      currentStep: 1,
      nextId: 3,
    }));

    render(TacticalBoard, {
      props: {
        boardKey: 'unit-board',
        teamName: 'Clontarf',
        opponentName: 'Crokes',
      },
    });

    const board = await screen.findByRole('application', { name: /Tactical board/i });
    expect(board).toHaveAttribute('tabindex', '0');
    expect(board.querySelector('svg')).toHaveAttribute('viewBox', '0 0 72.5 90');
    expect(screen.getByRole('button', { name: 'Shot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pen' })).toBeInTheDocument();
    expect(screen.getByText('Select mode')).toBeInTheDocument();
    expect(screen.getByText('drag players to set positions.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear marks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset positions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset board' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close Board' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('button', { name: 'Export PNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2x' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Compact' })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Hide pitch labels' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide movement tracks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide previous ghosts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Left half' })).toHaveClass('active');
  });
});
