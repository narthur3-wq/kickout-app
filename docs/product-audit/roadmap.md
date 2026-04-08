# Product Audit Roadmap

Roadmap date: 2026-04-08
Last revised: 2026-04-08

This roadmap turns the shell-bloat audit into an execution plan. It is ordered by risk reduction and dependency, not by file size alone. The goal is to get `src/App.svelte` back to a thin shell while keeping behavior stable and tests green.

The line budgets below are guardrails, not the end goal. If a phase preserves behavior, keeps tests green, and clearly improves ownership, that matters more than hitting an exact line count.

## Current Baseline

- `src/App.svelte`: 3,649 lines
- `src/lib/PossessionAnalysisPanel.svelte`: 1,936 lines
- `src/lib/AnalyticsPanel.svelte`: 1,135 lines
- `src/lib/PassImpactPanel.svelte`: 1,009 lines
- `src/lib/CaptureForm.svelte`: 852 lines
- `src/lib/AdminPanel.svelte`: 764 lines
- `src/lib/liveInsights.js`: 776 lines

Note: the original audit baseline was already stale by the time this roadmap was written. Active development continued adding to `App.svelte` during planning. The line-count budget rule below is the primary control against further drift.

## Ownership Rules (Agreed)

### The Shell Test

Something belongs in `App.svelte` if and only if it requires knowledge of two or more sibling concerns simultaneously.

**Stays in the shell:**
- Wiring events between child components
- Top-level routing and tab state
- Auth gate rendering
- Passing props to the right child at the right time

**Moves out:**
- Any function that only reads/writes localStorage → `storageScope.js` or `matchStore.js`
- Any function that derives a value from events → `analyticsHelpers.js` / `postMatchAnalysis.js`
- Any function that talks to Supabase → `analysisSync.js` / `syncState.js`
- Any function that formats data for display → `eventHelpers.js`
- Any function you could test in a plain `.test.js` file without importing Svelte

**Practical rule:** if you can write a unit test for it without Svelte setup, it does not belong in a `.svelte` file.

### Module Naming Rule

Modules must be named after what they contain, not where they are currently used. A module named after its consumer (e.g. `appShellHelpers`) attracts unrelated functions because the boundary becomes "whatever that file needs" rather than a domain boundary. Prefer names like `eventHelpers.js`, `kickoutAnalytics.js`, or `syncQueue.js` that describe the owned concept.

### No New `*Manager` Modules

Do not create broad `*Manager.js` buckets. If you cannot name a module without "Manager" or "Utils", the boundary is not solid yet. Find the domain noun first.

## Line-Count Budget (CI Enforced)

`App.svelte` has a hard line-count ceiling enforced in CI. The ceiling starts at 3,700 and is lowered after each successful extraction phase. Treat the budget as a drift signal, not the only success criterion. A build that pushes the file above the ceiling must explicitly raise the budget with a justification comment — making growth a visible, deliberate decision rather than silent drift.

Add to CI (`.github/workflows/ci.yml` or equivalent):

```bash
lines=$(wc -l < src/App.svelte)
budget=3700
if [ "$lines" -gt "$budget" ]; then
  echo "App.svelte exceeds line budget ($lines / $budget). Move logic to a module first."
  exit 1
fi
```

Budgets by phase:

| After phase | Ceiling |
| --- | --- |
| Baseline (now) | 3,700 |
| Phase 1 complete | 2,600 |
| Phase 2 complete | 2,000 |
| Phase 3 complete | 1,400 |

## Existing Seams To Reuse

These modules already exist and should be the first places we keep or move logic. Sizes as of this revision are included so drift is visible.

| Module | Lines | Declared purpose |
| --- | --- | --- |
| `analysisSync.js` | 167 | Supabase row serialization and merge logic for analysis state |
| `analysisUiState.js` | 56 | Per-panel UI state save/load/clear against localStorage |
| `analyticsHelpers.js` | — | Analytics derivation helpers |
| `appShellHelpers.js` | 84 | **See note below — rename candidate** |
| `captureDraft.js` | 36 | Draft signature and dirty-state detection — needs expansion |
| `diagnostics.js` | 109 | Diagnostic recording and formatting |
| `eventRecord.js` | 55 | Event record normalization |
| `matchStore.js` | 374 | Match entity persistence and normalization |
| `postMatchAnalysis.js` | 468 | Post-match derivations |
| `postMatchAnalysisStore.js` | 291 | Analysis state persistence |
| `storageScope.js` | 239 | Storage key namespacing and scope helpers |
| `syncState.js` | 99 | Sync cursor and row-merge primitives |

**`appShellHelpers.js` note:** This module currently contains pure domain utilities (`normText`, `matchKeyOf`, `eventYearOf`, `analyticsMarkerShape/Fill/Ring`, `buildCurrentMatchScore`) that have nothing to do with the shell. It should be renamed `eventHelpers.js` in Phase 0 to prevent it accumulating unrelated functions. Its contents belong in the event-formatting domain, not the app-shell domain.

**`captureDraft.js` note:** Currently only 36 lines — two functions. `App.svelte` still owns a large amount of capture draft logic that should live here. Expanding this module is a Phase 1 priority.

## Roadmap Rules

- Do not add new business logic to `App.svelte` unless it passes the Shell Test above.
- Prefer extracting into the smallest owning module instead of creating broad buckets.
- Prefer the existing seams first; create a new module only when no current home fits cleanly.
- Phase 0 is mapping and test-safety work only. Do not move substantial behavior until the ownership map is agreed.
- Every extraction lands with tests before the next extraction phase starts.
- Do not introduce a new state library or rewrite the app architecture to solve this.
- Do not chase file-size reduction if it increases coupling or makes testing worse.
- Do not split the shell UI before the logic underneath it is already thinned.

## Phase 0 — Baseline And Boundary Map

**Objective:** Lock down the ownership map before moving code, and keep this phase to mapping plus safety-net work.

**Workstream:**

- Rename `appShellHelpers.js` → `eventHelpers.js` and update all import sites.
- Inventory the major responsibilities still owned by `App.svelte` against the Shell Test above.
- Assign one home for each concern: auth/session, match scope, sync, persistence, capture draft, diagnostics, and derived analytics.
- Confirm which existing seams already cover each responsibility and which need expanding (especially `captureDraft.js` and `syncState.js`).
- Add the CI line-count budget check at 3,700 lines.
- Add or extend tests around existing helper seams to establish the safety net.

**Exit criteria:**

- Every major `App.svelte` responsibility has a named owner module.
- `appShellHelpers.js` is renamed and all imports updated.
- CI budget check is in place and green.
- No new user-facing behavior introduced.
- Baseline test gate still passes.

**Validation:**
- `npm run lint`
- `npm run test:unit`
- `npm run build`

## Phase 1 — Extract Non-Visual Shell Services

**Objective:** Remove persistence, sync, diagnostics, and draft mechanics from the shell.

**Workstream:**

| Slice | Move out of `App.svelte` | Target home |
| --- | --- | --- |
| Storage and match scope | localStorage reads/writes, scope activation, persistence coordination | `storageScope.js`, `matchStore.js` |
| Sync cursor and queue | Supabase queue handling, cursor management, retry coordination | `syncState.js`, `analysisSync.js` |
| UI state persistence | Per-panel UI state save/load/clear | `analysisUiState.js` |
| Draft and event normalization | Draft building, validation, undo/load helpers, event shaping | `captureDraft.js`, `eventRecord.js` |
| Diagnostics | Support report formatting, export bundle generation, local clearing | `diagnostics.js` |
| Auth/session glue | Access gating, session-scoped bootstrap logic | `supabase.js` and thin shell wrapper only if needed |

**Sync extraction caution:** Sync has implicit ordering dependencies (queue ordering, retry semantics, conflict resolution) that are not visible from function signatures. Before moving any sync code, write down the invariants: what ordering does the queue guarantee? What happens if a flush overlaps a new enqueue? Extract only after those questions have written answers.

**Exit criteria:**

- `App.svelte` no longer serializes state blobs directly to localStorage.
- Queue semantics and persistence formats have one source of truth.
- Capture, sync, and diagnostics behavior are covered by focused unit tests.
- CI budget lowered to 2,600 lines and green.

**Validation:**
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

## Phase 2 — Extract Pure Analytics And Summary Logic

**Objective:** Move all deterministic calculations out of UI components.

**Workstream:**

- Extract kickout, score, zone, clock, player, and summary derivations into `postMatchAnalysis.js`, `analyticsHelpers.js`, and `liveInsights.js`.
- The `vizEvents` boundary in `App.svelte` (around line 2,482 in the current file) is the cleanest seam: everything from there to end-of-script is `f(vizEvents) → derived stats` with no side effects. Cut here first.
- Pattern for reactive statements: extract the computation as a pure exported function, call it inside a thin `$:` wrapper in `App.svelte`. The reactive statement stays in the shell but becomes one line instead of 20.
- Remove duplicate formatter, list-building, and bucketing logic from `PossessionAnalysisPanel.svelte`, `AnalyticsPanel.svelte`, and `PassImpactPanel.svelte`. Only confirm duplication is real and semantically identical before consolidating — shared utility sprawl is a common trap.
- Add unit tests for pure derivations before moving the next analytics branch.

**Exit criteria:**

- Every summary helper has direct unit coverage.
- No panel owns a private copy of the same aggregation or formatter logic.
- CI budget lowered to 2,000 lines and green.
- Rough size targets for panels:
  - `PossessionAnalysisPanel.svelte` under ~1,400 lines
  - `AnalyticsPanel.svelte` under ~1,000 lines
  - `PassImpactPanel.svelte` under ~800 lines

**Validation:**
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

## Phase 3 — Split The Shell UI (Conditional)

**Objective:** Reduce template density in `App.svelte` — only pursue this if Phase 1 and 2 leave the file still structurally unclear.

**Condition for proceeding:** After Phase 2, re-evaluate the remaining `App.svelte` template. If the markup is thin and readable, this phase may not be needed. If it still inlines all tab markup in a way that obscures the shell's responsibility, proceed.

**Workstream:**

- Extract thin wrapper components for the major tabs (`CaptureTab.svelte`, `AnalyticsTab.svelte`, etc.).
- Keep the shell responsible for shared banners, top-level routing, auth state, and tab selection only.
- Lazy-load the heaviest analysis and export paths only if bundle load time is a measurable user problem — confirm with bundle analysis before assuming it is.
- Add a bundle size budget to make load-cost regressions visible if lazy-loading is introduced.

**Caution:** Tab extraction creates pressure to lift state back up, which often ends in prop drilling or a premature global store. Do not split tabs just to reduce line count.

**Exit criteria (structural, not numeric):**

- `App.svelte` contains no function longer than 30 lines.
- `App.svelte` makes no direct localStorage calls.
- `App.svelte` contains no inline data derivations — only wiring and rendering.
- CI budget lowered to 1,400 lines and green.

**Validation:**
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

## Phase 4 — Hardening And Regression Proof

**Objective:** Prove the refactor preserved behavior and establish release readiness.

**Workstream:**

- Add or update component tests for each new wrapper or split boundary.
- Extend E2E coverage for the refactored capture, analytics, and event-edit flows.
- Keep the repo-wide release gate green: lint, typecheck, unit, E2E, and build.
- Update docs if module ownership or user-facing flow changed visibly.

**Exit criteria:**

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test:unit` passes.
- `npm run test:e2e` passes.
- `npm run build` passes.
- `npm run check:full` passes.
- No user-visible behavior changed without a corresponding test update.

## Suggested Implementation Order

1. Rename `appShellHelpers.js` → `eventHelpers.js` and update imports.
2. Add CI line-count budget check.
3. Complete Phase 0 boundary map — assign every `App.svelte` responsibility a named owner.
4. Extract `captureDraft`, `eventRecord`, `diagnostics`, and `analysisUiState` responsibilities (lowest risk, most testable).
5. Write sync invariants down, then extract `syncState` and `analysisSync` queue logic.
6. Extract `matchStore` and remaining storage glue.
7. Pull pure analytics derivations from `App.svelte` and the heavy panels into helper modules.
8. Re-evaluate `App.svelte` template — split tab wrappers only if the structure still obscures ownership.
9. Run full validation gate. Update docs only after the refactor is stable.

## What Not To Do

- Do not split this into microservices or a backend rewrite.
- Do not add a new state-management abstraction just to move lines around.
- Do not leave duplicate formatter or persistence logic behind in the shell.
- Do not chase file-size reduction if it increases coupling or makes testing worse.
- Do not name a module after its consumer (e.g. `appShellHelpers`) — name it after what it owns.
- Do not create `*Manager.js` buckets unless the domain noun genuinely does not exist.
- Do not extract sync code before writing down the ordering invariants it must preserve.
