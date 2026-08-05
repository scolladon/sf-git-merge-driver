# 005 — `pkg-pr-new` runs from a floating `npx`

- **Status:** accepted
- **Date:** 2026-08-05
- **Design:** docs/design/pkg-pr-new-pr-previews.md · **Supersedes/Refines:** none

## Context

The preview job invokes the third-party `pkg-pr-new` CLI. This repository pins every
GitHub Action to a version tag and lets Dependabot move it; `.github/zizmor.yml` relaxes
`unpinned-uses` to `ref-pin` specifically to encode that stance. An npm CLI fetched at
run time is not covered by that machinery either way, so how tightly to pin it is a
separate call. The same owner's `scolladon/tsgit` runs `npx pkg-pr-new publish` on
`latest`.

## Options considered

1. **`pkg-pr-new` as a `devDependency`** *(designer's recommendation)* — pros: exact
   version in `package-lock.json`, integrity-checked, Dependabot-maintained, and
   `npm ci` already runs in the job / cons: `npm run lint:dependencies` (knip) will
   report it unused unless taught that the binary is used from CI.
2. **`npx --yes pkg-pr-new@<exact>`** — pros: pinned, no new dependency / cons: bumps
   are manual and invisible to Dependabot.
3. **Floating `npx pkg-pr-new`** — pros: simplest, and consistent with the same owner's
   `tsgit` workflow / cons: an unpinned third-party CLI runs on every pull request.

## Decision

Run `npx pkg-pr-new publish` unpinned, matching `scolladon/tsgit`. Consistency across
the owner's repositories and keeping `lint:dependencies` free of a knip exception
outweigh pinning a CLI whose only job is to upload a tarball to a preview registry.

## Consequences

- This deviates from the design's recommendation; the design document is revised to
  record the choice and its reasoning rather than left contradicting it.
- The preview job depends on whatever `pkg-pr-new` version is `latest` at run time. An
  upstream breaking change surfaces as a red preview job on the next pull request — the
  same blast radius as any other preview failure: `e2e-tests` is skipped and no other
  job is affected.
- No `devDependency` is added, so `npm run lint:dependencies` needs no knip exception.
- If an upstream break ever does bite, option 2 is the one-line remedy.
