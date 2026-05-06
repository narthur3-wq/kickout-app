# Go-Live Backlog

Backlog date: 2026-04-30

Priority is based on release truth, launch risk, user value, and implementation cost.

## Resolved In This Tree

| ID | Title | Status | Notes |
| --- | --- | --- | --- |
| `AUD-BL-01` | Restore `CaptureForm` selected-state contract | done | Component contract restored; unit suite is green. |
| `AUD-BL-02` | Separate normal E2E from Supabase smoke credentials | done | Normal E2E now runs local/offline by default. |
| `AUD-BL-03` | Isolate or clean Supabase smoke data | done | Smoke uses a unique per-run opponent name. |
| `AUD-BL-04` | Re-establish green `check:full` | done | `npm run check:full` passed on 2026-04-30. |
| `AUD-PL-01` | Replace fail-open configured-cloud access errors with degraded state | done | Configured-cloud lookup failures now fail closed. |
| `AUD-PL-02` | Add minimum a11y validation | done | `npm run test:a11y` covers the core keyboard path. |
| `AUD-PL-03` | Route digest/share failures into diagnostics | done | Digest share failures now surface in diagnostics. |
| `AUD-PL-04` | Confirm launch operating model | done | Release docs now describe the local-first/cloud-optional model. |
| `AUD-PL-05` | Keep Supabase smoke mandatory and separate | done | Smoke remains explicit in release docs and test flow. |
| `AUD-FU-02` | Reduce first-install and precache weight | done | Export-only `html2canvas` is no longer precached. |
| `AUD-NTH-01` | Saved analysis presets | done | Quick preset save/apply added to analysis panels. |
| `AUD-NTH-03` | Coach handoff export polish | done | Digest panel now includes a quick copy-brief handoff path. |
| `TB-MVP-01` | Tactical board MVP/product polish | done | Board is always available from Tools, persists per match/training context, supports autoplay, speed, path-following runs, hidden player counters, pen marks, shots, half-pitch views, PNG export, compact tool rail, bottom step strip, smaller counters, navy/green keepers, and distinct clear/reset controls. |

## Remaining Post-Launch Improvements

| ID | Title | Priority | Severity | Category | Impact | Effort | Owner type | Acceptance criteria | Test requirements | File / module refs |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| `AUD-FU-01` | Split largest app-shell responsibilities | 70 | medium | architecture | Reduces regression risk and review cost. | L | Senior frontend | Auth/session, sync/storage, and import/export are smaller focused modules. | Focused unit/component regression tests. | `src/App.svelte`, `src/lib/*` |
| `AUD-FU-03` | Long-match performance profiling | 62 | medium | performance / reliability | Hundreds of events can amplify localStorage and derivation cost. | M | Frontend / QA | Large-history flows have measured interaction latency. | Performance smoke or scripted scenario. | `src/App.svelte`, analytics helpers |
| `AUD-FU-04` | Dependency refresh cadence | 55 | low | maintenance | Package drift is manageable now but should not compound. | M | Frontend / release | Patch/minor updates land in green batches; majors are planned separately. | `check:full` per batch. | `package.json`, `package-lock.json` |
| `TB-FU-01` | Edit existing tactical-board actions | 48 | low | UX | Coaches can adjust a drawn pass/run/shot without rebuilding the step. | M | Frontend | Existing moves can be selected, adjusted, and removed individually. | Component tests for select/edit/delete. | `src/lib/TacticalBoard.svelte` |

## Nice-To-Haves

| ID | Title | Priority | Category | Effort | Notes |
| --- | --- | ---: | --- | --- | --- |
| `AUD-NTH-02` | First-use orientation polish | 38 | UX | S | Existing docs and session labels help, but onboarding can still be smoother. |
| `TB-NTH-01` | Tactical-board templates and roster names | 34 | UX | M | Useful after persistence settles; avoid adding roster complexity to the MVP. |
| `AUD-FUT-01` | Video-linked event review | 20 | strategic | L | Only if video becomes a real product input. |
| `AUD-FUT-02` | GPS/workload views | 18 | strategic | L | Over-engineered without reliable tracking data. |
| `AUD-FUT-03` | ML-assisted tagging | 15 | strategic | L | Over-engineered until the workflow and labels are stable. |

## Quick Wins After Launch

- Add a light performance scenario for long event histories.
- Carve auth/session and sync orchestration into smaller modules.
- Refresh patch and minor dependencies in green batches.

## Highest-Risk Hidden Gotchas

- `src/App.svelte` is still a large concentration point, so low-risk changes there need extra review care.
- A passing `check:full` is not a replacement for the explicit Supabase smoke signoff.
- The cloud path is intentionally stricter now; if the access lookup fails, login should wait rather than silently continue.

## Do-Not-Do List

- Do not pull video, GPS, or ML work into launch-hardening work.
- Do not broaden cloud-backed E2E until there is server-side cleanup or a stronger isolation story.
- Do not use app-shell decomposition as an excuse to reopen the now-green release gate.
