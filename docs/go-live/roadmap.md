# Go-Live Remediation Roadmap

This roadmap mirrors the sprint grouping in `docs/go-live/backlog.md`. It is the short version of the plan; use the backlog for full acceptance criteria and file references.

## Completed During Prior Audit

### Objective

Clear the immediate validation and usability blockers that prevented even a conditional launch recommendation.

### Delivered

- `BL-01` fixed the analytics landscape overflow and restored a green layout spec.
- `BL-02` restored a green `npm run test:unit`.
- `BL-03` restored a green `npm run test:coverage`.

### Risk reduction achieved

- Removed the universal launch blockers found in the first audit pass.
- Restored trust in the local validation path.

## Sprint 0 - Release Hygiene And Handoff

### Objective

Decide whether the prior audit bundle should ship as one coherent set, then close the release-readiness gap around typechecking.

### Exact tasks

- Resolve the prior audit bundle as one unit.
- Keep or discard the dirty audit files together rather than piecemeal.
- Add a supported `typecheck` command and make it green.

### Dependencies

- Agreement on whether the audit bundle is being kept.
- A valid typecheck scope for the app sources.

### Owner type needed

- frontend/product engineer
- repo hygiene owner

### Acceptance criteria

- The audit bundle decision is recorded.
- The go-live docs remain internally consistent.
- `npm run typecheck` exists and passes, or there is a documented reason it is deferred.

### Risk reduction achieved

- Keeps the release story coherent before the feature sprints begin.

## Sprint 1 - Trust The Data

### Objective

Make the kickout story and sync story trustworthy enough that coaches can rely on the app in live use.

### Exact tasks

- Align kickout capture semantics and analytics totals with live operator expectations.
- Add an explicit sync banner and manual push path for pending cloud data.
- Execute the Supabase smoke path against the actual launch environment.

### Dependencies

- Launch environment and smoke credentials.
- A settled decision on whether cloud sync is in launch scope.

### Owner type needed

- frontend/product engineer
- QA / release engineer
- auth/sync owner

### Acceptance criteria

- Kickout labels and analytics use the same perspective.
- The sync banner is visible and can trigger a manual flush.
- The launch-environment smoke path is either proven or explicitly deferred by scope decision.

### Risk reduction achieved

- Prevents the trust-breaking "data is there, but the tab says otherwise" failure mode.

## Sprint 2 - Live Capture Reliability

### Objective

Make live entry fast and obvious on the devices people actually use at the sideline or in the stand.

### Exact tasks

- Fit full capture data entry without scrolling on iPad landscape.
- Replace the shared clock with remembered per-period clocks and safe paused defaults.
- Reorder capture so `Team` leads the flow on every screen size.
- Make Events edit/delete actions obvious and left-aligned.

### Dependencies

- A stable capture layout target.
- Agreement on the period-clock model.

### Owner type needed

- frontend engineer
- UX-minded product engineer

### Acceptance criteria

- Capture stays visible without scrolling on the target iPad landscape viewport.
- `H1`, `H2`, and `ET` each remember their own clock.
- `Team` appears above `Type`.
- Events actions are obvious at a glance.

### Risk reduction achieved

- Reduces operator friction in the highest-pressure part of the product.

## Sprint 3 - Match Model And Launch Hardening

### Objective

Extend the match model so it matches the real game, then close the highest-value usability and observability gaps.

### Exact tasks

- Extend shot capture and scoring for `Dropped short` and `Two Point`.
- Close the high-value accessibility gaps in login, search, pitch, and the summary modal.
- Add a minimal production observability path.

### Dependencies

- Stable capture and scoring semantics from Sprint 2.
- Agreement on the minimum launch accessibility and monitoring bar.

### Owner type needed

- senior frontend/product engineer
- accessibility-aware UI engineer
- release/ops partner

### Acceptance criteria

- The new shot taxonomy is represented consistently end-to-end.
- Key controls are keyboard and screen-reader sensible.
- Critical production failures can be reviewed somewhere outside the dev console.

### Risk reduction achieved

- Makes the app safer to use in real matches and easier to support after launch.

## Sprint 4 - Performance And Change Safety

### Objective

Make the app cheaper to load and safer to change without rewriting the shell.

### Exact tasks

- Reduce first-load cost where there is clear low-churn payoff.
- Extract the highest-risk shell concerns out of `src/App.svelte`.
- Expand validation coverage beyond Ubuntu-only CI.

### Dependencies

- A stable regression suite.
- The supported typecheck gate from Sprint 0.

### Owner type needed

- senior frontend engineer
- repo/platform engineer

### Acceptance criteria

- The main entry path is lighter or explicitly justified.
- `src/App.svelte` is less monolithic.
- Validation covers the supported platform risk better than Ubuntu-only CI.

### Risk reduction achieved

- Lowers future regression risk and improves contributor confidence.

## Sprint 5 - Repo And Platform Cleanup

### Objective

Tidy the repository and surrounding release hygiene so the project is easier to maintain after launch.

### Exact tasks

- Separate source docs from generated static artifacts.
- Refresh lagging dependencies in small verified batches.
- Add public metadata only if the deployed URL is truly public-facing.

### Dependencies

- Product decision on whether the app is public-facing.

### Owner type needed

- repo/platform engineer
- product engineer

### Acceptance criteria

- Docs, build artifacts, and metadata each live in the right place.
- Dependency refreshes land in small, green batches.

### Risk reduction achieved

- Makes the repo easier to reason about after launch without distracting from the core product work.

## Sprint 6 - Later Product Decision

### Objective

Decide whether a secondary total-match-time display is worth shipping after the half-by-half clock model has been proven in use.

### Exact tasks

- Evaluate whether a secondary total-match-time display adds real coaching value.

### Dependencies

- The period-specific clock model from Sprint 2.

### Owner type needed

- product engineer

### Acceptance criteria

- The product decision is documented before implementation.
- Any added display stays secondary to the per-period clocks.

### Risk reduction achieved

- Keeps the timing model focused until there is evidence the extra display is worth the extra complexity.
