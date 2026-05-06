import { describe, expect, it } from 'vitest';
import {
  interpolatePlayerPositionsAlongRuns,
  normalizeBoardSnapshot,
  pointAlongPath,
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
          step: 3,
          path: [{ x: 0.2, y: 0.3 }, { x: 1.3, y: -0.2 }],
          createdOrder: 4,
        },
      ],
      currentStep: 2,
      pitchView: 'right',
      playbackSpeed: 2,
      nextId: 5,
      hiddenPlayerIds: ['home-1', 'missing-player'],
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
      step: 3,
      path: [{ x: 0.2, y: 0.3 }, { x: 1, y: 0 }],
    });
    expect(snapshot.pitchView).toBe('right');
    expect(snapshot.playbackSpeed).toBe(2);
    expect(snapshot.hiddenPlayerIds).toEqual(['home-1']);
    expect(snapshot.showMovementTracks).toBe(true);
    expect(snapshot.showPreviousGhosts).toBe(true);
  });

  it('moves players along the drawn run path during playback', () => {
    const turnY = 45 / 145;
    const path = [
      { x: 0, y: 0 },
      { x: 0, y: turnY },
      { x: 0.5, y: turnY },
    ];

    const mid = pointAlongPath(path, 0.75);
    expect(mid.x).toBeCloseTo(0.25);
    expect(mid.y).toBeCloseTo(turnY);

    const positions = interpolatePlayerPositionsAlongRuns(
      [{ id: 'home-8', baseX: 0, baseY: 0 }],
      { 'home-8': { x: 0, y: 0 } },
      { 'home-8': { x: 0.5, y: turnY } },
      [{ type: 'run', playerId: 'home-8', path, createdOrder: 1 }],
      0.75,
    );

    expect(positions['home-8'].x).toBeCloseTo(mid.x);
    expect(positions['home-8'].y).toBeCloseTo(mid.y);
  });

  it('keys saved boards by match or training context', () => {
    expect(tacticalBoardStorageKey('user:1:match:abc')).toBe('ko_tactical_board:user:1:match:abc');
    expect(tacticalBoardStorageKey()).toBe('ko_tactical_board:training');
  });
});
