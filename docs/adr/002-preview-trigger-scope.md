# 002 — Preview trigger scope: pull requests only

- **Status:** accepted
- **Date:** 2026-08-05
- **Design:** docs/design/pkg-pr-new-pr-previews.md · **Supersedes/Refines:** none

## Context

pkg.pr.new publishes a preview for any commit its workflow runs on. The reference
implementation this change is ported from (`scolladon/tsgit`) publishes on both
`pull_request` and `push: [main]`, giving an installable build of trunk between
releases. This repository's `npm-service.yml` currently publishes dev builds on
`pull_request` only, and its `e2e-tests` job routes `channel` through an expression
keyed to exactly two mutually-exclusive event paths (`release` and `pull_request`).

## Options considered

1. **Pull requests only, as today** *(designer's recommendation)* — pros: no change to
   the `e2e-tests` `if:` and `channel:` expressions; no new matrix cost / cons: no
   installable build of trunk between releases.
2. **Add `push: [main]` with e2e** — pros: trunk installable and verified / cons: a
   third event path forces a rewrite of two expressions whose two-path shape is load
   bearing, and adds nine matrix cells per merge with no named consumer.
3. **Add `push: [main]`, preview only** — pros: trunk previews without the matrix cost /
   cons: produces preview URLs that nothing verifies.

## Decision

Publish previews on `pull_request` only. `main` is release-please-managed and a real
`latest-rc` publish follows a merge quickly, so the window a trunk preview would cover
is thin.

## Consequences

- `e2e-tests` keeps its current two-path `if:` and `channel:` expressions; the only edit
  there is the renamed job in `needs`.
- Anyone wanting to install trunk between releases uses the published `latest-rc`
  channel.
- Revisit the moment someone actually asks to install trunk; option 3 becomes the cheap
  answer at that point.
