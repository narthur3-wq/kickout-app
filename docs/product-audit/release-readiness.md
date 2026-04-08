# Release Readiness

## Current Launch Risks

- Access checks can still fail open on a transient network error.
- The Supabase smoke path is skipped unless the env is prepared.
- Documentation does not fully match the current product surface.
- Concurrent analysts can still create duplicate data if they share the same stream.
- Onboarding can partially fail and leave a messy admin state.
- Diagnostics are local-only and not yet support-grade.
- The browser matrix is still Chromium-only.

## Pre-Launch Checklist

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:unit`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] `npm run test:coverage` passes in the launch environment
- [ ] Supabase smoke path runs with a dedicated account
- [ ] Access checks fail closed or use an explicit degraded-state UI
- [ ] At least one WebKit or mobile Safari lane passes
- [ ] README and user guide match the current tabs and workflows
- [ ] Release checklist matches the actual launch flow
- [ ] Multi-analyst workflow rules are documented and obvious
- [ ] Diagnostics export path is available to support staff

## Smoke-Test Checklist

1. Sign in with a dedicated Supabase test account.
2. Create or open a match.
3. Capture at least one event.
4. Save or finalize the session.
5. Reload the app.
6. Confirm the saved data is still present.
7. Open the analysis tabs and confirm the current scope is readable.
8. Confirm the diagnostics path is available if something fails.

## Monitoring, Logging, and Analytics Gaps

- No remote diagnostics ingestion path.
- No central error dashboard.
- No production alerting on sync or onboarding failures.
- No performance telemetry for the main tab load path.
- No explicit analytics on where users drop out of the capture flow.

## Rollback Readiness

The deployment model is simple, which is good:

- Vercel can roll back quickly.
- Supabase schema changes live separately from the frontend.
- Local storage still preserves the user's data if cloud sync is unavailable.

The weak point is database and edge-function change management:

- migrations need to stay forward-compatible
- onboarding function changes need explicit smoke coverage
- there is no obvious automated rollback for partially applied Supabase-side changes

## Ownership / Signoff List

| Area | Owner type | Signoff requirement |
| --- | --- | --- |
| Product scope | Product | Docs and launch scope are realistic. |
| UX flow | UX / product | First-use path is understandable. |
| Frontend | Frontend | Core flows work and the bundle is acceptable. |
| QA | QA | Coverage, e2e, and smoke gates are green. |
| Operations | Ops | Supabase env, smoke creds, and diagnostics path are ready. |
| Backend / Supabase | Full-stack | Onboarding and sync paths are safe to retry. |

## What Must Be True Before Launch Confidence Is Justified

1. The release gate passes in the actual environment, including coverage.
2. The cloud smoke path is repeatable and not optional.
3. Access checks fail closed or have a clearly bounded degraded-state UI.
4. The docs match the app users will see.
5. Support can understand and extract failure state.
6. Shared-workflow risks are documented and, where possible, guarded.
7. No major launch path depends on video or GPS that does not exist.

If those conditions are not true, the product is still useful, but it is not launch-tight.
