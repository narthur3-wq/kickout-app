import { describe, expect, it, vi } from 'vitest';
import {
  aggregateConnections,
  analysisPointForSession,
  buildOutcomeBreakdown,
  buildPossessionSummary,
  buildPointSeries,
  buildPlayerDirectory,
  ballDistanceMeters,
  carryDistanceMeters,
  carryPathPoints,
  collectPlayerOptions,
  depthDeltaMeters,
  formatMetres,
  movementDirection,
  movementDirectionForSession,
  movementDirectionColor,
  movementDirectionLabel,
  normalizeOptionalPoint,
  normalizePointList,
  pointDistanceMeters,
  possessionActionFamily,
  possessionOutcomeNeedsTarget,
  resolveSessionPlayerIdentity,
  sessionLabel,
  storagePointForSession,
  splitMatchIdsForTrend,
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

  it('normalizes optional points and clamps waypoint lists', () => {
    expect(normalizeOptionalPoint({ x: 0.1, y: 0.2 })).toEqual({ x: 0.1, y: 0.2 });
    expect(normalizeOptionalPoint({ x: null, y: 0.2 })).toBeNull();
    expect(normalizePointList([
      { x: 0.1, y: 0.2 },
      { x: '', y: 0.4 },
      { x: 0.3, y: 0.5 },
      { x: 0.4, y: 0.6 },
      { x: 0.5, y: 0.7 },
    ], { maxLength: 3 })).toEqual([
      { x: 0.1, y: 0.2 },
      { x: 0.3, y: 0.5 },
      { x: 0.4, y: 0.6 },
    ]);
  });

  it('requires a destination point for pass outcomes only', () => {
    expect(possessionOutcomeNeedsTarget('Hand pass')).toBe(true);
    expect(possessionOutcomeNeedsTarget('Kick pass')).toBe(true);
    expect(possessionOutcomeNeedsTarget('Score point')).toBe(false);
    expect(possessionOutcomeNeedsTarget('')).toBe(false);
  });

  it('groups possession outcomes into analysis families', () => {
    expect(possessionActionFamily('Score point')).toBe('scores');
    expect(possessionActionFamily('Shot wide')).toBe('shots');
    expect(possessionActionFamily('Hand pass')).toBe('passes');
    expect(possessionActionFamily('Possession lost')).toBe('losses');
    expect(possessionActionFamily('Foul won')).toBe('fouls');
  });

  it('computes carry distance over waypoints rather than a straight line', () => {
    const receive = { x: 0.5, y: 0.2 };
    const release = { x: 0.5, y: 0.4 };
    const carryWaypoints = [
      { x: 0.65, y: 0.28 },
      { x: 0.35, y: 0.34 },
    ];

    const path = carryPathPoints(receive, release, carryWaypoints);
    const straightDistance = pointDistanceMeters(receive, release);
    const carryDistance = carryDistanceMeters(receive, release, carryWaypoints);

    expect(path).toHaveLength(4);
    expect(carryDistance).toBeGreaterThan(straightDistance);
  });

  it('normalizes session points and direction toward the attacking end', () => {
    const session = { our_goal_at_top: false };

    expect(analysisPointForSession({ x: 0.25, y: 0.2 }, session)).toEqual({ x: 0.25, y: 0.8 });
    const storagePoint = storagePointForSession({ x: 0.25, y: 0.8 }, session);
    expect(storagePoint.x).toBeCloseTo(0.25, 6);
    expect(storagePoint.y).toBeCloseTo(0.2, 6);
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

  it('splits match ids for trend comparisons', () => {
    const matchIds = ['m3', 'm1', 'm2', 'm4'];
    const dateLookup = {
      m1: '2026-03-02',
      m2: '2026-03-03',
      m3: '2026-03-01',
      m4: '2026-03-04',
    };

    const halves = splitMatchIdsForTrend(matchIds, { dateLookup, mode: 'halves' });
    expect(halves.ordered).toEqual(['m3', 'm1', 'm2', 'm4']);
    expect(halves.earlier).toEqual(['m3', 'm1']);
    expect(halves.recent).toEqual(['m2', 'm4']);

    const lastN = splitMatchIdsForTrend(matchIds, { dateLookup, mode: 'lastN', lastN: 3 });
    expect(lastN.earlier).toEqual(['m3']);
    expect(lastN.recent).toEqual(['m1', 'm2', 'm4']);
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

  it('uses waypoint-aware carry distance in possession summaries', () => {
    const events = [
      {
        receive: { x: 0.5, y: 0.2 },
        carry_waypoints: [{ x: 0.65, y: 0.28 }, { x: 0.35, y: 0.34 }],
        release: { x: 0.5, y: 0.4 },
        target: { x: 0.5, y: 0.58 },
        outcome: 'Hand pass',
      },
    ];

    const summary = summarizePossessionEvents(events);
    expect(summary.total).toBe(1);
    expect(summary.averageCarry).toBeCloseTo(
      carryDistanceMeters(events[0].receive, events[0].release, events[0].carry_waypoints),
      5,
    );
    expect(summary.averageBall).toBeCloseTo(
      ballDistanceMeters(events[0].release, events[0].target),
      5,
    );
    expect(summary.ballEvents).toBe(1);
  });

  it('computes score involvement for empty events', () => {
    const summary = buildPossessionSummary([]);
    expect(summary.directScores).toBe(0);
    expect(summary.assistCount).toBe(0);
    expect(summary.scoreInvolvement).toBe(0);
    expect(summary.scoreInvolvementRate).toBeNull();
  });

  it('computes score involvement for direct scores only', () => {
    const summary = buildPossessionSummary([
      { outcome: 'Score point' },
      { outcome: 'Score goal' },
    ]);
    expect(summary.directScores).toBe(2);
    expect(summary.assistCount).toBe(0);
    expect(summary.scoreInvolvement).toBe(2);
    expect(summary.scoreInvolvementRate).toBeCloseTo(1, 5);
  });

  it('computes score involvement for assists only', () => {
    const summary = buildPossessionSummary([
      { outcome: 'Passed / offloaded', assist: true },
      { outcome: 'Foul won', assist: true },
    ]);
    expect(summary.directScores).toBe(0);
    expect(summary.assistCount).toBe(2);
    expect(summary.scoreInvolvement).toBe(2);
    expect(summary.scoreInvolvementRate).toBeCloseTo(1, 5);
  });

  it('does not count invalid assists and warns once per invalid event', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const summary = buildPossessionSummary([
      { outcome: 'Possession lost', assist: true },
      { outcome: 'Score point', assist: true },
    ]);
    expect(summary.directScores).toBe(1);
    expect(summary.assistCount).toBe(0);
    expect(summary.scoreInvolvement).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('treats legacy events without assist as false', () => {
    const summary = buildPossessionSummary([
      { outcome: 'Passed / offloaded' },
      { outcome: 'Foul won' },
    ]);
    expect(summary.assistCount).toBe(0);
    expect(summary.directScores).toBe(0);
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
