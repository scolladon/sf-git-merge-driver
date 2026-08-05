# 003 — Publish the prebuilt tarball, not the source directory

- **Status:** accepted — adopted-as-recommended (no user judgment)
- **Date:** 2026-08-05
- **Design:** docs/design/pkg-pr-new-pr-previews.md · **Supersedes/Refines:** none

## Context

`pkg-pr-new publish` accepts either source directories, which it packs itself via
`npm pack --json`, or prebuilt `.tgz` inputs, which it uploads as-is without repacking.
Both paths run `prepack` — which wireit resolves to `build` + `build:bin`, then
`oclif manifest && oclif readme` — so the packaged contents are equivalent. The two
differ in where the pack happens and in which CLI flags remain available.

## Options considered

1. **Prebuilt tarball: `npm pack` then `pkg-pr-new publish "./$TARBALL"`** *(designer's
   recommendation)* — pros: the artifact is byte-identical to what `npm publish` would
   ship for that commit, and the pack step stays visible and independently debuggable in
   the job log / cons: forfeits `--previewVersion`, which is rejected in tarball mode.
2. **Source directory: bare `pkg-pr-new publish`** — pros: one fewer step / cons: the
   pack happens inside a third-party CLI, so a pack failure surfaces as a publish
   failure.
3. **Source directory plus `--previewVersion`** — pros: previews report
   `0.0.0-preview-<sha>` instead of the released version / cons: same opacity as 2, and
   the version rewrite is a monorepo-oriented feature this single-package repo does not
   need.

## Decision

Pack first, publish the resulting tarball: `npm pack`, then
`pkg-pr-new publish "./$TARBALL"`. The preview is exactly the artifact a real publish
would produce.

## Consequences

- Every preview reports the current `package.json` version (`1.9.1` today), so a preview
  install is not distinguishable from the published release by version string alone.
  This is not a regression — the `dev-pr-<N>` tarballs it replaces had the same property.
- Workspace-dependency rewriting and `--previewVersion` are unavailable. Neither applies
  to a single-package repository.
- The existing `npm run build` step stays ahead of `npm pack` so compile and lint
  failures are reported as their own step; the pack's `prepack` is then a wireit cache
  hit.
