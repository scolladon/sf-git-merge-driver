# 004 — Legacy `dev-pr-*` releases are reaped by hand at merge time

- **Status:** accepted
- **Date:** 2026-08-05
- **Design:** docs/design/pkg-pr-new-pr-previews.md · **Supersedes/Refines:** none

## Context

The flow being removed created a GitHub prerelease and a git tag named `dev-pr-<N>` per
pull request, reaped by a `cleanup` job on `pull_request: closed`. Deleting that job
leaves whatever already exists unreaped. Two are live at the time of this change —
`dev-pr-205` and `dev-pr-207` — both belonging to pull requests that are still open, so
their release assets are install links somebody may be using right now.

## Options considered

1. **Delete both releases and their tags by hand at merge time** *(designer's
   recommendation)* — pros: no stale entries left behind, and nothing breaks while the
   PRs are still open / cons: a manual step someone has to remember.
2. **Leave them** — pros: no action / cons: two misleading prerelease entries and their
   tags stay on the releases page indefinitely.
3. **Keep `cleanup` alive temporarily to drain the backlog** — pros: automatic / cons:
   retains a `contents: write` job on a `pull_request` trigger, which is the exact thing
   this change exists to remove.

## Decision

Delete the `dev-pr-205` and `dev-pr-207` releases and their tags by hand once this
change merges — not on this branch, because both pull requests are still open and their
assets are live until then. Leave a note on each pull request pointing at its new
preview URL.

## Consequences

- One manual follow-up at merge time, tracked in the pull request body so it is not
  forgotten.
- After this, no automation in the repository creates or deletes anything in the
  `dev-pr-*` namespace; release-please and `on-published-release.yml` continue to own
  real release tags.
