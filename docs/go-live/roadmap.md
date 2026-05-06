# Go-Live Remediation Roadmap

Roadmap date: 2026-04-30

This roadmap is ordered by release truth first: keep the validation signal trustworthy, hold the launch path disciplined, then improve maintainability and performance after launch.

## Status Snapshot

- Phase 0 is complete in the current tree.
- Phase 1 is complete for the minimum launch-hardening scope.
- Tactical board MVP/product polish is complete through the 2026-05-06 update.
- Phase 2 remains the main post-launch engineering work.
- Phase 3 stays intentionally out of launch scope.

## Phase 0 - Restore The Release Gate

Objective:

- Make the current working tree measurable and releasable again.

Status:

- complete

Evidence:

- `npm run check:full` passed on 2026-04-30.
- `npm run test:smoke` passed separately against the smoke environment.

| Task | Status | Notes |
| --- | --- | --- |
| `AUD-BL-01` Restore `CaptureForm` selected-state test contract | complete | Selected-state indicator contract restored. |
| `AUD-BL-02` Separate ordinary E2E from Supabase smoke credentials | complete | Normal E2E is local/offline by default. |
| `AUD-BL-03` Reset or isolate smoke data | complete | Smoke uses unique per-run naming. |
| `AUD-BL-04` Re-run full release validation | complete | `check:full` passed and should be recorded in the release checklist. |

## Phase 1 - Pre-Launch Risk Reduction

Objective:

- Remove the highest launch risks without broad rewrites.

Status:

- complete for launch minimums

| Task | Status | Notes |
| --- | --- | --- |
| `AUD-PL-01` Replace fail-open configured-cloud access errors with degraded state | complete | Configured-cloud access lookup failures now fail closed. |
| `AUD-PL-02` Add a lightweight a11y gate | complete | `npm run test:a11y` added and passing. |
| `AUD-PL-03` Route digest/share failures into diagnostics | complete | Digest share failures now report into diagnostics. |
| `AUD-PL-04` Document launch operating model | complete | User guide and release checklist now describe the model clearly. |
| `AUD-PL-05` Keep Supabase smoke mandatory and separate | complete | Smoke remains outside `check:full` and inside release signoff. |
| `TB-MVP-01` Tactical board MVP/product polish | complete | Persistence, autoplay, speed control, path-following runs, hidden player counters, pen marks, shot arrows, half-pitch views, PNG export, compact tool rail, bottom step strip, smaller counters, navy/green keepers, and safer destructive actions are in the board overlay. |

## Phase 2 - Early Post-Launch Strengthening

Objective:

- Reduce change risk and field performance issues after the launch gate is stable.

| Task | Owner type | Effort | Acceptance criteria | File / module refs |
| --- | --- | --- | --- | --- |
| `AUD-FU-01` Split app-shell responsibilities | Senior frontend | L | Auth/session, sync/storage, and import/export are extracted into focused modules with tests. | `src/App.svelte`, `src/lib/*` |
| `AUD-FU-03` Profile long-match runtime behavior | Frontend / QA | M | Long event histories are tested for interaction latency and localStorage write cost. | `src/App.svelte`, `src/lib/liveInsights.js`, `src/lib/analyticsHelpers.js` |
| `AUD-FU-04` Dependency refresh in small batches | Frontend / release | M | Patch/minor upgrades land green before major upgrades are attempted. | `package.json`, `package-lock.json` |
| `TB-FU-01` Select/edit existing tactical-board actions | Frontend | M | Existing passes, runs, shots, and pen strokes can be selected and changed without rebuilding the board. | `src/lib/TacticalBoard.svelte` |

## Phase 3 - Nice-To-Haves And Strategic Options

These are not launch requirements.

| Task | Status | Notes |
| --- | --- | --- |
| `AUD-NTH-01` Saved analysis presets | complete | Quick preset save/apply is already in the tree. |
| `AUD-NTH-02` First-use orientation polish | backlog | Worth doing, but not a launch gate. |
| `AUD-NTH-03` Coach handoff polish | complete | Digest now supports a copy-brief handoff flow. |
| `TB-NTH-01` Tactical-board templates and roster names | backlog | Defer until the MVP is proven in real coaching use. |
| `AUD-FUT-01` Video-linked review | not planned for launch | Strategic only. |
| `AUD-FUT-02` GPS/workload views | not planned for launch | Strategic only. |
| `AUD-FUT-03` ML-assisted tagging | not planned for launch | Strategic only. |

## Recommended Execution Order

1. Run the real-device and launch-environment smoke items from the release checklist.
2. If launch proceeds, treat `AUD-FU-01` as the first structural cleanup.
3. Add long-history performance coverage before broadening analytics features.
4. Refresh dependencies in small green batches only.

## Sequencing Notes

- Do not fold the Supabase smoke proof into the normal regression suite.
- Do not reopen the now-green release gate with broad refactors before launch.
- Do not add video, GPS, or ML work to launch hardening.
