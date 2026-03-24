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
})
