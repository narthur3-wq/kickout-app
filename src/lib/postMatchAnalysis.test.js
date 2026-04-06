import { describe, expect, it } from 'vitest';
import {
  aggregateConnections,
  analysisPointForSession,
  buildOutcomeBreakdown,
  buildPossessionSummary,
  buildPointSeries,
  buildPlayerDirectory,
  collectPlayerOptions,
  depthDeltaMeters,
  formatMetres,
  movementDirection,
  movementDirectionForSession,
  movementDirectionColor,
  movementDirectionLabel,
  pointDistanceMeters,
  resolveSessionPlayerIdentity,
  sessionLabel,
  summarizePossessionEvents,
} from './postMatchAnalysis.js';

describe('postMatchAnalysis helpers', () => {
  it('classifies movement direction using pitch depth', () => {
    expect(movementDirection({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.32 })).toBe('forward');
    expect(movementDirection({ x: 0.5, y: 0.32 }, { x: 0.5, y: 0.2 })).toBe('backward');
    expect(movementDirection({ x: 0.2, y: 0.3 }, { x: 0.42, y: 0.31 })).toBe('lateral');
  });

  it('computes metres and labels for a movement', () => {
    const from = { x: 0.25, y: 0.25 };
    const to = { x: 0.45, y: 0.35 };

    expect(depthDeltaMeters(from, to)).toBeCloseTo(14.5, 1);
    expect(pointDistanceMeters(from, to)).toBeGreaterThan(0);
    expect(formatMetres(pointDistanceMeters(from, to))).toMatch(/m$/);
    expect(movementDirectionLabel('forward')).toBe('Forward');
    expect(movementDirectionColor('backward')).toBe('#dc2626');
  });

  it('normalizes session points and direction toward the attacking end', () => {
    const session = { our_goal_at_top: false };

    expect(analysisPointForSession({ x: 0.25, y: 0.2 }, session)).toEqual({ x: 0.25, y: 0.8 });
    expect(movementDirectionForSession({ x: 0.25, y: 0.8 }, { x: 0.25, y: 0.6 }, session)).toBe('forward');
    expect(movementDirectionForSession({ x: 0.25, y: 0.2 }, { x: 0.25, y: 0.4 }, session)).toBe('backward');
  });

  it('formats session labels with counts and dates', () => {
    expect(sessionLabel({
      player_name: '#8',
      events: [{ id: 'one' }, { id: 'two' }],
      created_at: '2026-04-01T12:00:00.000Z',
    }, 0, 'pass', 'passes')).toBe('1. #8 - 2 passes - 2026-04-01');
  });

  it('collects player options from arrays, strings, and records', () => {
    const options = collectPlayerOptions([
      ['8', '#8'],
      '  #15  ',
      { player_name: '  #11  ' },
    ], ['player_name']);

    expect(options.map((option) => option.label)).toEqual(['#11', '#15', '#8']);
  });

  it('builds point series and outcome breakdowns', () => {
    const events = [
      { receive_x: 0.1, receive_y: 0.2, outcome: 'Score' },
      { receive_x: 0.4, receive_y: 0.5, outcome: 'Lost' },
      { receive_x: null, receive_y: 0.5, outcome: 'Lost' },
    ];

    expect(buildPointSeries(events, (event) => ({ x: event.receive_x, y: event.receive_y }))).toHaveLength(2);
    expect(buildOutcomeBreakdown(events)).toEqual([
      { label: 'Lost', count: 2 },
      { label: 'Score', count: 1 },
    ]);
  });

  it('resolves session identity using squad player ids and name matches', () => {
    const squadPlayers = [
      { id: 'p1', name: 'Cian Murphy', name_key: 'cian murphy' },
      { id: 'p2', name: 'Aoife Kelly', name_key: 'aoife kelly' },
    ];
    const direct = resolveSessionPlayerIdentity({ player_name: 'Cian Murphy', squad_player_id: 'p1' }, squadPlayers);
    const fallback = resolveSessionPlayerIdentity({ player_name: 'Aoife Kelly' }, squadPlayers);
    const legacy = resolveSessionPlayerIdentity({ player_name: '  #11  ' }, squadPlayers);

    expect(direct.key).toBe('squad:p1');
    expect(fallback.key).toBe('squad:p2');
    expect(legacy.key).toBe('#11');
  });

  it('builds player directories with event counts', () => {
    const squadPlayers = [{ id: 'p1', name: 'Cian Murphy', name_key: 'cian murphy' }];
    const sessions = [
      { player_name: 'Cian Murphy', events: [{ id: 'e1' }, { id: 'e2' }] },
      { player_name: 'Cian Murphy', events: [{ id: 'e3' }] },
      { player_name: 'Orla', events: [] },
    ];

    const directory = buildPlayerDirectory(sessions, squadPlayers);
    const cian = directory.find((item) => item.key === 'squad:p1');
    const orla = directory.find((item) => item.key === 'orla');

    expect(cian.count).toBe(2);
    expect(cian.eventCount).toBe(3);
    expect(orla.count).toBe(1);
  });

  it('summarizes possession events with directions and outcomes', () => {
    const events = [
      { receive: { x: 0.5, y: 0.2 }, release: { x: 0.5, y: 0.32 }, outcome: 'Score' },
      { receive: { x: 0.5, y: 0.32 }, release: { x: 0.5, y: 0.2 }, outcome: 'Lost' },
      { receive: { x: 0.2, y: 0.3 }, release: { x: 0.42, y: 0.31 }, outcome: 'Lost' },
    ];

    const summary = summarizePossessionEvents(events);
    expect(summary.total).toBe(3);
    expect(summary.forwardCount).toBe(1);
    expect(summary.backwardCount).toBe(1);
    expect(summary.lateralCount).toBe(1);
    expect(summary.topOutcome).toBe('Lost');
    expect(buildPossessionSummary(events).totalEvents).toBe(3);
  });

  it('aggregates connections across repeated endpoints', () => {
    const lines = aggregateConnections([
      { from_x: 0.2, from_y: 0.2, to_x: 0.55, to_y: 0.3, completed: true },
      { from_x: 0.2, from_y: 0.2, to_x: 0.55, to_y: 0.3, completed: false },
      { from_x: 0.6, from_y: 0.4, to_x: 0.7, to_y: 0.52, completed: true },
    ], {
      fromSelector: (event) => ({ x: event.from_x, y: event.from_y }),
      toSelector: (event) => ({ x: event.to_x, y: event.to_y }),
      completionSelector: (event) => event.completed,
    });

    expect(lines).toHaveLength(2);
    expect(lines[0].count + lines[1].count).toBe(3);
    expect(lines.find((line) => line.incompleteCount === 1)).toBeTruthy();
  });
});
