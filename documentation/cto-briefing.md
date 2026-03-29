# Pairc - CTO Briefing

## Executive summary

Pairc is a focused GAA match-day analysis product.

It is strongest when used as:

- a live event capture tool
- an analyst interpretation surface
- a coach handoff tool

It is not yet a broad club analysis platform. That is a positioning choice as much as a feature gap.

Current state:

- product is operational and tested
- architecture is good enough for continued use
- main management risks are documentation drift and shell complexity, not fundamental technical weakness

## What the product does well

- captures kickouts, shots, and turnovers quickly on a tablet or phone
- keeps working in poor connectivity because saves are local-first
- produces immediate match reads in `Live`
- produces a coach-facing summary in `Digest`
- supports backup/import/export workflows

## What it is not yet

It is not yet a full club platform with:

- season-long player development workflows
- broad role-based experiences
- collaboration tooling
- presentation/reporting suites
- full operational admin depth

That is acceptable if the commercial strategy is specialist-first.

## Technical posture

Current stack:

- Svelte 5
- Vite 7
- optional Supabase auth + Postgres
- Vercel deployment

Current strengths:

- offline-first behavior
- clear event schema
- good helper-module coverage
- meaningful browser regression coverage

Current structural concern:

- `App.svelte` still carries too many responsibilities

This is manageable, but it is the main long-term maintenance hotspot.

## Product posture

Best-fit customer today:

- one analyst
- one team
- one clear match-day workflow

Best-fit commercial framing:

- specialist live GAA analysis tool
- not an all-in-one club platform

## Current management risks

1. Documentation drift
- written docs had fallen behind the product and can easily mislead future maintainers or operators if not kept current

2. Shell complexity
- app-shell responsibilities are still concentrated

3. Workflow discipline for shared matches
- two analysts can share a match only if they split responsibility and avoid duplicate logging

## Recommendation

Keep Pairc focused.

Near-term priority should be:

- maintain trust in live use
- keep the visual language coherent
- keep the shell maintainable
- keep documentation aligned with real product behavior

The biggest mistake from here would be trying to turn it into a broad platform before fully finishing the narrow match-day workflow.
