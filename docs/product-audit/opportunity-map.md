# Opportunity Map

This map focuses on what would materially improve the product without violating the current constraints.

Current constraints respected here:

- no video
- no GPS / location tracking

## Missing Essentials for a Serious Launch

These are not nice-to-haves. They are the capabilities the product should have before anyone calls it launch-ready.

1. A fail-closed or explicitly degraded access policy.
2. A reliable launch gate with working smoke checks.
3. Docs that match the current product surface.
4. A support path for failed sync, onboarding, or local storage issues.
5. Guardrails for multi-analyst duplication.

Without those, the product is useful but not operationally excellent.

## Near-Term Opportunities Within Current Constraints

| Opportunity | User value | Business value | Complexity | Dependencies | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Access control hardening | High | High | Low | None | Now |
| Reliable release operations | High | High | Low | None | Now |
| Better analyst onboarding and guidance | High | High | Low | None | Now |
| Stronger shared-workflow guardrails | High | High | Medium | Operating rules | Now |
| Exportable diagnostics and clearer failure states | High | High | Medium | None | Now |
| Saved views / presets for analysis states | Medium | Medium | Medium | Stable baseline | Later |
| Richer coach handoff outputs | High | High | Medium | Digest stability | Now |
| Cross-match comparison improvements | Medium | High | Medium | Current analysis baseline | Later |
| Better session recovery and undo around analysis edits | Medium | Medium | Medium | Current edit flow | Later |

## Alternatives to Video-Dependent Ideas

Video is not available, so the product should not pretend it has clip review. The practical alternatives are:

- event bookmarks and manual notes for key moments
- shareable digest images and summary snapshots
- timestamped session markers for review after the match
- clear, filterable event sequences instead of clip timelines
- editable finalised analysis events so the analyst can correct the record quickly

These alternatives preserve user value without requiring a video pipeline.

## Alternatives to GPS-Dependent Ideas

GPS is not available, so the app should avoid implying tracking precision it cannot actually provide. The practical alternatives are:

- zone-based event maps from the captured pitch coordinates
- pressure / receive / release patterns based on recorded events
- carry direction and sequence summaries
- phase-based comparisons using the existing match and event model
- manual notes for tactical context instead of load or movement claims

These give useful spatial insight without pretending to be player tracking.

## If Video or GPS Later Become Available

Only if strategy changes should the product pursue the following:

- event-to-video clip linking
- searchable clip library by player, phase, or event type
- workload and movement profiling from real tracking inputs
- pressure and pressing-trap maps derived from tracking
- opposition scouting timelines with clip evidence
- shareable coaching packs that combine clip, event, and spatial context

These are high-value opportunities, but they depend on future product strategy and real data sources.

## Prioritized Opportunity List

| Opportunity | User value | Business value | Engineering complexity | Dependency on future capabilities | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Access control hardening | High | High | Low | None | Now |
| Release reliability and supportability | High | High | Low | None | Now |
| Clearer first-use experience and analyst guidance | High | High | Low | None | Now |
| Multi-analyst workflow guardrails | High | High | Medium | None | Now |
| Better coach handoff exports | High | High | Medium | None | Now |
| Saved views and analysis presets | Medium | Medium | Medium | None | Later |
| Cross-match comparison enhancements | Medium | High | Medium | None | Later |
| Editable finalised analysis events | Medium | High | Medium | None | Later |
| Video-linked review | Very high | Very high | High | Yes | Only if strategy changes |
| GPS / movement tracking views | Very high | High | High | Yes | Only if strategy changes |
| ML-assisted tagging | Medium | Medium | High | No, but needs a lot of data | Later |

## What This Product Should Lean Into Now

The most commercially sensible path is to double down on the manual match-day workflow:

- fast capture
- trustworthy live read
- clean coach handoff
- reliable analysis review
- understandable support and recovery

That path is valuable on its own and does not need video or GPS to be credible.

## What Would Be Premature

- a platform rewrite
- a video roadmap before the manual workflow is trusted
- GPS or workload claims without actual tracking data
- ML features before the base taxonomy and correction flows are stable
- broad collaboration features before shared-workflow guardrails exist
