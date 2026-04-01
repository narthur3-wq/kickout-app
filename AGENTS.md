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
