# Go-Live Remediation Roadmap

Audit date: 2026-04-06

This roadmap maps directly to the findings in `docs/go-live/audit.md` and the execution items in `docs/go-live/backlog.md`.

## Phase 0 - Blockers before launch

Objective:

- Make the release gate trustworthy and prove the real launch environment for any Supabase-backed scope.

Exact tasks:

- `BL-01` Stabilize or replace the broken coverage gate so `npm run test:coverage` and `npm run check:full` are deterministic on the approved release path.
- `BL-02` Run the Supabase smoke path against staging or the real launch environment and record the result.
- `BL-03` Verify `ALLOWED_ORIGIN`, Supabase Auth redirect URLs, and any invite/reset dependencies against the deployed domain.

Dependencies:

- Access to the actual launch environment and smoke credentials.
- Agreement on whether cloud auth/sync and admin onboarding are in launch scope.

Owner type needed:

- frontend engineer
- QA / release engineer
- Supabase / platform owner

Estimated effort:

- M

Acceptance criteria:

- `npm run test:coverage` either passes reliably on the supported release machine or is replaced by a deterministic approved coverage command.
- `npm run check:full` is trustworthy again.
- `npm run test:smoke` passes, or the repo explicitly documents that cloud scope is deferred.
- Admin onboarding and password reset are verified end-to-end against the real domain.

Risk reduction achieved:

- Removes the two conditions currently blocking an unconditional launch recommendation.

## Phase 1 - Must-fix before launch

Objective:

- Reduce the biggest operational, accessibility, and performance risks without adding large abstractions.

Exact tasks:

- `BL-04` Add a supportable operator-visible path for sync, onboarding, and share failures beyond device-local diagnostics.
- `BL-05` Close key accessibility gaps on login, pitch, summary modal, and event search, and add one automated a11y regression check.
- `BL-06` Decide and document the offline fail-open access policy and device-loss/revocation handling.
- `BL-07` Put a simple budget around first-load cost and defer one non-core surface if it materially improves install/open performance.
- `BL-08` Add a Windows validation path or a required pre-release Windows check.

Dependencies:

- Phase 0 complete.
- Agreement on the minimum acceptable launch-day support posture.

Owner type needed:

- frontend engineer
- UX / accessibility-minded product engineer
- release / operations owner

Estimated effort:

- M

Acceptance criteria:

- Support staff can review critical client failures somewhere other than browser console only.
- Key controls have explicit accessible names and sane keyboard behavior.
- The access-revocation policy is documented and approved.
- The build has an explicit bundle target and at least one measured improvement or approved exception.
- The supported-platform validation path is documented and repeatable.

Risk reduction achieved:

- Cuts the highest-value launch-day support and usability risks without a rewrite.

## Phase 2 - Should-fix shortly after launch

Objective:

- Improve change safety and repo clarity once launch-critical work is complete.

Exact tasks:

- `BL-09` Extract auth, sync, import/export, and diagnostics seams out of `src/App.svelte`.
- `BL-10` Separate source docs from generated artifacts and document the real deployment artifact path.
- `BL-11` Refresh lagging patch/minor dependencies in small validated batches.

Dependencies:

- Launch gate stable.
- A calm post-launch window with time for low-risk refactoring and cleanup.

Owner type needed:

- senior frontend engineer
- repo / platform engineer

Estimated effort:

- L

Acceptance criteria:

- `src/App.svelte` is materially smaller in responsibility, not just moved around cosmetically.
- Docs/build artifact ownership is obvious to a new contributor.
- Dependency refreshes land in small green batches with no release regression.

Risk reduction achieved:

- Lowers future regression cost and makes the repo easier to maintain after launch.

## Phase 3 - Later improvements

Objective:

- Only pursue deeper improvements when usage data proves the payoff.

Exact tasks:

- Revisit broader performance work if first-install pain shows up in field feedback.
- Expand observability if the user base or support burden grows beyond a small trusted team.
- Add public metadata or product analytics only if the app becomes public-facing and those signals matter.

Dependencies:

- Real post-launch usage data.

Owner type needed:

- product engineer
- platform / ops partner

Estimated effort:

- M

Acceptance criteria:

- Each later improvement is justified by measured usage pain or clear product need.
- No speculative rewrite is introduced in the name of “future-proofing”.

Risk reduction achieved:

- Keeps the roadmap pragmatic and prevents over-engineering after launch.
