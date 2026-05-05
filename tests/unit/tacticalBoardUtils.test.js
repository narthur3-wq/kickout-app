import { describe, expect, it } from 'vitest';
import {
  normalizeBoardSnapshot,
  tacticalBoardStorageKey,
} from '../../src/lib/tacticalBoardUtils.js';

describe('tacticalBoardUtils', () => {
  it('normalizes tactical board snapshots with shot, pen and playback state', () => {
    const snapshot = normalizeBoardSnapshot({
      players: [
        { id: 'home-1', team: 'home', number: 1, baseX: -1, baseY: 2 },
      ],
      moves: [
        {
          id: 'shot-1',
          type: 'shot',
          team: 'home',
          playerId: 'home-1',
          target: { x: 2, y: -1 },
          step: 2,
          createdOrder: 3,
        },
      ],
      penStrokes: [
        {
          id: 'pen-1',
          color: '#60a5fa',
          width: 9,
          path: [{ x: 0.2, y: 0.3 }, { x: 1.3, y: -0.2 }],
          createdOrder: 4,
        },
      ],
      currentStep: 2,
      pitchView: 'right',
      playbackSpeed: 2,
      nextId: 5,
    });

    expect(snapshot.players[0]).toMatchObject({ id: 'home-1', baseX: 0, baseY: 1 });
    expect(snapshot.moves[0]).toMatchObject({
      id: 'shot-1',
      type: 'shot',
      target: { x: 1, y: 0 },
      step: 2,
    });
    expect(snapshot.penStrokes[0]).toMatchObject({
      id: 'pen-1',
      color: '#60a5fa',
      width: 3,
      path: [{ x: 0.2, y: 0.3 }, { x: 1, y: 0 }],
    });
    expect(snapshot.pitchView).toBe('right');
    expect(snapshot.playbackSpeed).toBe(2);
  });

  it('keys saved boards by match or training context', () => {
    expect(tacticalBoardStorageKey('user:1:match:abc')).toBe('ko_tactical_board:user:1:match:abc');
    expect(tacticalBoardStorageKey()).toBe('ko_tactical_board:training');
  });
});
