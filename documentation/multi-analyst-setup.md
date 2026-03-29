# Pairc - Multi-Analyst Setup

## Supported use

Two analysts can contribute to the same match if:

- both accounts belong to the same team scope
- both devices use the same team, opponent, and match date
- both devices eventually sync

## Important constraint

Pairc does not deduplicate two analysts logging the same event independently.

If both people record the same kickout or shot, the app will treat them as separate events.

## Recommended operating model

Best live split:

- Analyst 1: Kickouts
- Analyst 2: Shots and Turnovers

This minimizes duplicate risk and gives the best combined feed into `Live` and `Digest`.

## Pre-match checklist

Before throw-in, both analysts should confirm:

- same team
- same opponent
- same match date
- same period
- same pitch orientation
- same team account scope

## During the match

- do not both log the same event stream
- if one analyst misses something, correct it later rather than both jumping onto the same category
- stay online where possible if you want near-live cross-device visibility

## Operational expectation

Shared-match capture is workable today, but it works best with discipline rather than automatic conflict resolution.
