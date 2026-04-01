Copy-paste prompt for the full go-live audit

Save this as .github/codex/prompts/go-live-audit.md in the repo, or just paste it into Codex from the repo root.

You are acting as a pragmatic principal engineer, staff product engineer, release manager, QA lead, and UX reviewer for this repository.

Your job is to perform a complete production go-live audit for this app and then create a concrete remediation plan and backlog directly inside the repo.

## Goal

Get this repo to a best-in-class, production-ready state from an architecture, engineering, UX, testing, reliability, and performance point of view, without over-engineering it.

Be opinionated, practical, and cost-aware. Favor the simplest solution that materially improves quality, reliability, maintainability, and user experience.

## Working style

- Start by understanding the repo before changing anything.
- Read the codebase, configuration, tests, package manifests, CI, deployment setup, Vercel config, environment variable usage, and docs.
- Use subagents in parallel for distinct workstreams, then consolidate findings:
  1. architecture and code health
  2. frontend UX and accessibility
  3. performance and Core Web Vitals risks
  4. testing and QA gaps
  5. security and hidden production gotchas
  6. dependency freshness and repo coherence
  7. release and operations readiness
- Do not suggest speculative rewrites.
- Do not add heavy abstractions unless there is a clear payoff.
- Prefer incremental, high-confidence improvements.
- Distinguish clearly between:
  - critical launch blockers
  - important pre-launch fixes
  - post-launch improvements
  - nice-to-haves

## Audit scope

Assess at minimum:

### Product and UX
- clarity of information architecture
- navigation and user journeys
- empty states, loading states, error states
- form UX
- mobile responsiveness
- accessibility
- copy clarity where it materially affects usability
- visual consistency and interaction polish
- SEO/social metadata if relevant
- onboarding or first-run friction
- hidden UX regressions or "looks fine in happy path only" issues

### Architecture and engineering
- overall repo structure and coherence
- separation of concerns
- accidental complexity
- dead code / stale patterns / duplicated logic
- data-fetching patterns
- caching and invalidation risks
- server/client boundary correctness
- auth/session/security risks if present
- environment variable handling
- error handling and observability
- logging quality
- feature flag or config safety if present
- build/deploy assumptions
- Vercel-specific risks and edge/runtime gotchas if present
- maintainability and ease of future change

### Dependency and repo hygiene
- package manager consistency
- lockfile correctness
- outdated, unused, duplicated, or conflicting dependencies
- type safety and linting quality
- CI coherence
- scripts coherence
- README / setup accuracy
- consistency across configs

### Testing and QA
- current test coverage quality, not just quantity
- whether material behaviors are protected
- unit/integration/e2e balance
- edge-case coverage
- regression protection for critical flows
- flaky or low-value tests
- missing test helpers or fixtures
- release verification gaps

### Performance
- obvious bundle bloat
- unnecessary client-side work
- hydration issues
- rendering inefficiencies
- image/font/script optimization opportunities
- caching opportunities
- expensive network patterns
- slow-path risks in critical journeys
- anything likely to hurt Core Web Vitals or perceived speed

### Release readiness
- launch blockers
- rollback risks
- monitoring gaps
- analytics gaps if material
- env/config/deployment checklist gaps
- undocumented operational risks
- "hidden gotchas" that will bite after launch

## What to produce

Create or update these files in the repository:

1. `docs/go-live/audit.md`
2. `docs/go-live/roadmap.md`
3. `docs/go-live/backlog.md`
4. `docs/go-live/release-checklist.md`

If `docs/` does not exist, create it.

## Required contents

### `docs/go-live/audit.md`
Include:
- executive summary
- launch recommendation: GO / GO WITH CONDITIONS / NO-GO
- top 10 findings by impact
- architecture review
- UX review
- testing review
- performance review
- security / reliability / hidden gotchas
- dependency and repo coherence review
- release-readiness review
- what is already good and should be preserved
- explicit list of assumptions and unknowns

For every issue include:
- ID
- title
- severity: blocker / high / medium / low
- area
- why it matters
- evidence (file references, commands, or observed behavior)
- recommended fix
- effort: S / M / L
- confidence: high / medium / low

### `docs/go-live/roadmap.md`
Create a phased remediation plan:
- Phase 0: blockers before launch
- Phase 1: must-fix before launch
- Phase 2: should-fix shortly after launch
- Phase 3: later improvements

For each phase include:
- objective
- exact tasks
- dependencies
- owner type needed
- estimated effort
- acceptance criteria
- risk reduction achieved

### `docs/go-live/backlog.md`
Create a complete actionable backlog in priority order.

Use this format for every item:
- ID
- title
- priority score (1-100)
- severity
- user/business impact
- technical risk
- effort
- owner type
- dependencies
- acceptance criteria
- test requirements
- rollout notes
- file/module references

Group the backlog into:
- Launch blockers
- Pre-launch must-haves
- Post-launch high-value work
- Cleanup / polish

Also add:
- a "recommended execution order" section
- a "quick wins under half a day" section
- a "do not do" section for over-engineered ideas that are unnecessary

### `docs/go-live/release-checklist.md`
Create a practical checklist for launch day covering:
- config/env
- build
- deploy
- smoke test
- monitoring/logs
- analytics
- rollback readiness
- ownership and signoff

## Execution rules

- Run the relevant repo commands to validate assumptions.
- Run tests, lint, typecheck, and build where available.
- If tests are missing or insufficient, say exactly what is missing.
- If something is broken, fix it only when the fix is high-confidence and within scope.
- If you make code changes, keep them minimal and justified.
- Add or improve tests for any material fixes you make.
- Do not silently leave TODOs in code.
- Do not claim something is good enough without evidence.
- Call out uncertainty explicitly.
- Prefer concrete findings over generic advice.

## Final deliverable behavior

Before finishing:
1. ensure the four markdown files exist and are coherent
2. ensure backlog items map back to findings
3. ensure roadmap phases map to backlog items
4. ensure acceptance criteria are testable
5. ensure recommendations are pragmatic and not over-engineered
6. provide a concise final summary in chat with:
   - launch status
   - top blockers
   - quickest wins
   - highest risk hidden gotchas
   - first 5 backlog items to execute
2) Add this small AGENTS.md to the repo root

This gives Codex durable repo-specific instructions, which is exactly what AGENTS.md is for. Keep it small.

# AGENTS.md

## Repository expectations

- Treat this repository as a production-bound app. Optimize for pragmatic quality, not cleverness.
- Prefer minimal, high-confidence changes over rewrites.
- Avoid over-engineering. Only introduce abstractions when they clearly reduce present complexity or risk.
- When reviewing or changing code, always evaluate:
  - architecture coherence
  - UX quality
  - accessibility
  - testing sufficiency
  - performance
  - security/reliability
  - release readiness
- Before concluding work, run the relevant validation commands available in the repo:
  - lint
  - typecheck
  - tests
  - build
- If validation is missing, state exactly what is missing and what should exist.
- For material fixes, add or improve tests where practical.
- Store go-live audit outputs in:
  - `docs/go-live/audit.md`
  - `docs/go-live/roadmap.md`
  - `docs/go-live/backlog.md`
  - `docs/go-live/release-checklist.md`
- Use file references and evidence for all major findings.
- Explicitly separate:
  - launch blockers
  - pre-launch fixes
  - post-launch improvements
  - nice-to-haves
- Flag over-engineered ideas as such instead of recommending them.
3) How to run it

Codex supports local repo work in the CLI, IDE, and app, and the GitHub Action supports a committed prompt-file, so storing the prompt in-repo is a clean setup.

Commit AGENTS.md.
Commit .github/codex/prompts/go-live-audit.md.
Open the repo in Codex and run the prompt from repo root.
After fixes start landing, run a second pass with /review and tell Codex to focus only on unresolved blockers and regressions.
4) Tightened version if you want Codex to both audit and start fixing immediately

Use this instead of the big prompt's first paragraph:

Do the full go-live audit first, then immediately fix any high-confidence blocker or high-severity issue that can be resolved safely in this session with minimal code churn. For every fix, add or update tests if the behavior is material. Do not attempt broad refactors. After changes, update the audit, roadmap, backlog, and release checklist to reflect what was fixed versus what remains.
5) The one thing most people miss

Do not just ask for "an audit." Ask Codex to produce repo-stored artifacts with IDs, priorities, acceptance criteria, and execution order. That turns a vague review into something your team can actually ship against.

If you want, I can also turn this into a ready-to-commit AGENTS.md + prompt-file pair tailored to a Next.js/Vercel repo specifically.
