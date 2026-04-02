import { describe, expect, it } from 'vitest'
import { buildScoreSnapshots } from './score.js'

describe('buildScoreSnapshots', () => {
  it('recomputes pre-event score state after historical edits', () => {
    const events = [
      {
        id: 'ko-1',
        match_date: '2026-03-24',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 1,
        created_at: '2026-03-24T10:00:00.000Z',
        event_type: 'kickout',
        outcome: 'Retained',
        direction: 'ours',
      },
      {
        id: 'shot-1',
        match_date: '2026-03-24',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 2,
        created_at: '2026-03-24T10:01:00.000Z',
        event_type: 'shot',
        outcome: 'Goal',
        direction: 'ours',
      },
      {
        id: 'ko-2',
        match_date: '2026-03-24',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 3,
        created_at: '2026-03-24T10:02:00.000Z',
        event_type: 'kickout',
        outcome: 'Lost',
        direction: 'ours',
      },
      {
        id: 'shot-2',
        match_date: '2026-03-24',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 4,
        created_at: '2026-03-24T10:03:00.000Z',
        event_type: 'shot',
        outcome: 'Point',
        direction: 'theirs',
      },
      {
        id: 'ko-3',
        match_date: '2026-03-24',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 5,
        created_at: '2026-03-24T10:04:00.000Z',
        event_type: 'kickout',
        outcome: 'Won',
        direction: 'theirs',
      },
    ]

    const snapshots = buildScoreSnapshots(events)

    expect(snapshots.get('ko-1')).toMatchObject({ us: 0, them: 0, margin: 0, usDisplay: '0-0', themDisplay: '0-0' })
    expect(snapshots.get('shot-1')).toMatchObject({ us: 0, them: 0, margin: 0, usDisplay: '0-0', themDisplay: '0-0' })
    expect(snapshots.get('ko-2')).toMatchObject({ us: 3, them: 0, margin: 3, usDisplay: '1-0', themDisplay: '0-0' })
    expect(snapshots.get('shot-2')).toMatchObject({ us: 3, them: 0, margin: 3, usDisplay: '1-0', themDisplay: '0-0' })
    expect(snapshots.get('ko-3')).toMatchObject({ us: 3, them: 1, margin: 2, usDisplay: '1-0', themDisplay: '0-1' })
  })

  it('counts two-point scores in the running totals and display', () => {
    const events = [
      {
        id: 'shot-1',
        match_date: '2026-03-26',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 1,
        created_at: '2026-03-26T10:00:00.000Z',
        event_type: 'shot',
        outcome: 'Two Point',
        direction: 'ours',
      },
      {
        id: 'ko-1',
        match_date: '2026-03-26',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 2,
        created_at: '2026-03-26T10:01:00.000Z',
        event_type: 'kickout',
        outcome: 'Retained',
        direction: 'ours',
      },
    ]

    const snapshots = buildScoreSnapshots(events)

    expect(snapshots.get('shot-1')).toMatchObject({ us: 0, them: 0, margin: 0, usDisplay: '0-0', themDisplay: '0-0' })
    expect(snapshots.get('ko-1')).toMatchObject({ us: 2, them: 0, margin: 2, usDisplay: '0-2', themDisplay: '0-0' })
  })

  it('keeps separate matches isolated', () => {
    const snapshots = buildScoreSnapshots([
      {
        id: 'match-a-score',
        match_date: '2026-03-24',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 1,
        created_at: '2026-03-24T10:00:00.000Z',
        event_type: 'shot',
        outcome: 'Point',
        direction: 'ours',
      },
      {
        id: 'match-b-ko',
        match_date: '2026-03-25',
        team: 'Clontarf',
        opponent: 'Na Fianna',
        ko_sequence: 1,
        created_at: '2026-03-25T10:00:00.000Z',
        event_type: 'kickout',
        outcome: 'Retained',
        direction: 'ours',
      },
    ])

    expect(snapshots.get('match-a-score')).toMatchObject({ us: 0, them: 0, margin: 0, usDisplay: '0-0', themDisplay: '0-0' })
    expect(snapshots.get('match-b-ko')).toMatchObject({ us: 0, them: 0, margin: 0, usDisplay: '0-0', themDisplay: '0-0' })
  })

  it('isolates two matches with the same date, team, and opponent when they have distinct match_ids', () => {
    // This was the silent bleed bug: same logical key but different match records
    // (e.g. a replayed fixture) were scored as one match before the match_id fix.
    const snapshots = buildScoreSnapshots([
      {
        id: 'match-a-goal',
        match_id: 'match-a',
        match_date: '2026-04-05',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 1,
        created_at: '2026-04-05T10:00:00.000Z',
        event_type: 'shot',
        outcome: 'Goal',
        direction: 'ours',
      },
      {
        id: 'match-b-point',
        match_id: 'match-b',
        match_date: '2026-04-05',
        team: 'Clontarf',
        opponent: 'Vincents',
        ko_sequence: 1,
        created_at: '2026-04-05T14:00:00.000Z',
        event_type: 'shot',
        outcome: 'Point',
        direction: 'theirs',
      },
    ])

    // Each match starts at 0-0; the goal from match-a must not bleed into match-b.
    expect(snapshots.get('match-a-goal')).toMatchObject({ us: 0, them: 0, usDisplay: '0-0', themDisplay: '0-0' })
    expect(snapshots.get('match-b-point')).toMatchObject({ us: 0, them: 0, usDisplay: '0-0', themDisplay: '0-0' })
  })

  it('falls back to logical key grouping for events without a match_id', () => {
    // Legacy events (pre-match-entity migration) have no match_id.
    // They should still be grouped and scored correctly by date|team|opponent.
    const snapshots = buildScoreSnapshots([
      {
        id: 'legacy-point',
        match_date: '2026-03-10',
        team: 'Clontarf',
        opponent: 'Crokes',
        ko_sequence: 1,
        created_at: '2026-03-10T10:00:00.000Z',
        event_type: 'shot',
        outcome: 'Point',
        direction: 'ours',
      },
      {
        id: 'legacy-ko',
        match_date: '2026-03-10',
        team: 'Clontarf',
        opponent: 'Crokes',
        ko_sequence: 2,
        created_at: '2026-03-10T10:01:00.000Z',
        event_type: 'kickout',
        outcome: 'Retained',
        direction: 'ours',
      },
    ])

    expect(snapshots.get('legacy-point')).toMatchObject({ us: 0, them: 0, usDisplay: '0-0', themDisplay: '0-0' })
    expect(snapshots.get('legacy-ko')).toMatchObject({ us: 1, them: 0, usDisplay: '0-1', themDisplay: '0-0' })
  })
})
