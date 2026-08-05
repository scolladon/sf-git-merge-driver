# 001 — PR preview comment strategy

- **Status:** accepted
- **Date:** 2026-08-05
- **Design:** docs/design/pkg-pr-new-pr-previews.md · **Supersedes/Refines:** none

## Context

pkg.pr.new publishes a preview tarball per PR and its GitHub App posts a comment
carrying the install command. That comment reads `npm i <url>`, which is the wrong
command for an `sf` CLI plugin — users need `sf plugins install <url>` — and the text
is not customizable: `--comment` accepts only `off|create|update`. The workflow it
replaces posts its own comment with the correct command via
`thollander/actions-comment-pull-request@v3`. A workflow-authored comment needs
`pull-requests: write`, which GitHub does not grant to `pull_request` runs from forks.

## Options considered

1. **App comment only (`--comment=update`)** — pros: zero extra permissions, the job
   needs nothing beyond `contents: read`, and it works on fork PRs / cons: tells every
   reviewer to run a command that does not install an `sf` plugin.
2. **`--comment=off` + workflow-authored comment, same-repo only** *(designer's
   recommendation)* — pros: preserves today's exact UX and reuses an action already in
   the file / cons: keeps `pull-requests: write` on the job; fork PRs get no comment.
3. **Both** — pros: correct text internally, some comment on forks / cons: two comments
   on every internal PR, which is the common case.

## Decision

Publish with `--comment=off` and post the repository's own PR comment carrying
`sf plugins install <url>`, gated on `github.event.pull_request.head.repo.full_name ==
github.repository`. Fork PRs deliberately get no workflow comment; their preview URL
remains discoverable on the `Continuous Releases` check run that pkg.pr.new creates
unconditionally, and in the job log.

## Consequences

- The preview job retains `pull-requests: write`. `contents: write` still disappears
  from every `pull_request`-triggered job, which is the privilege reduction that
  motivated the change.
- Any future change to the install instructions is a repository edit, not a request to
  an upstream service.
- Fork contributors read their preview URL off the check run rather than a comment. If
  that proves to be friction in practice, revisit with option 3.
