# 006 — Craft design and ADR artifacts stay out of the repository

- **Status:** accepted
- **Date:** 2026-08-05
- **Design:** docs/design/pkg-pr-new-pr-previews.md · **Supersedes/Refines:** none

## Context

This repository treats `docs/` as local-only except `docs/media/` — `.git/info/exclude`
carries `/docs/*` with `!/docs/media/` and the comment *"docs/: only media/ is
committed; everything else is local-only"*. Substantial design documents
(`IMPLEMENTATION_PLAN.md`, `PEER_DEPENDENCIES_DESIGN.md`, `binary-entrypoint.md`,
`docs/plans/`) all live there untracked. The craft workflow writes its design document
to `docs/design/` and its ADRs to `docs/adr/`, and requires each to be a committed
artifact so a dead agent can be respawned from it.

## Options considered

1. **Commit for handoff, strip before the pull request** — pros: craft's artifact
   handoff holds during the run, the pull request carries only the change itself, and
   the repository convention is honored / cons: the artifacts survive only as local
   copies and in intermediate branch history.
2. **Commit them into the repository** — pros: durable, reviewable provenance in the
   pull request / cons: contradicts the stated `docs/` convention and adds several
   hundred lines of documentation to a workflow-only change.

## Decision

Craft writes its design document and ADRs into `docs/design/` and `docs/adr/` and
commits them on the feature branch so the handoff holds. Before the pull request is
opened they are removed from the branch tip in a dedicated commit, and the files are
copied into the main checkout's untracked `docs/` so they remain available locally. The
pull request carries only the workflow change.

## Consequences

- The pull request diff stays proportional to the change.
- The design rationale is not readable from the repository; whatever a reviewer needs to
  know has to be in the pull request body. The pull request body therefore carries the
  decision summary, not a pointer to a committed document.
- Any future craft run in this repository follows the same rule; the `docs/*` exclude is
  left untouched.
- Files that only exist to serve those documents — such as cspell dictionary entries
  added for words appearing solely in them — must be dropped in the same strip commit if
  nothing tracked still needs them.
