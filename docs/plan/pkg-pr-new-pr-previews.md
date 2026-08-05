# Plan — pkg.pr.new PR previews

> Source: design doc `docs/design/pkg-pr-new-pr-previews.md` · ADRs 001-006 (all accepted)
> The plan is the implementation script AND the knowledge handoff. Part agents start
> with zero context: whatever a part block omits is paid later as agent rediscovery.
> `plan-lint.sh` enforces the schema below — the plan phase cannot close without it.

## Sizing rules

- Every part costs a full agent lifecycle (spin-up, zero-context rebuild, gate) — it
  must earn it. No standalone test-only parts for FEATURE code: coverage/interop/property
  tests fold into the implementation part whose code they exercise. EXCEPTION:
  test-infra-only and docs-only parts (tooling config, test helpers, fixtures,
  harness/ADV/property suites, docs/prose) with no `src/` delta ARE standalone — they
  have no implementation part to fold into.
- A part that would be a pure test pass over already-landed code merges into its
  neighbour.

## Why one part

This change has no `src/` delta and no unit-test surface. It is a single YAML file,
`.github/workflows/npm-service.yml`, and every seam that looked splittable produces a
semantically broken intermediate commit:

- **Job rename cannot be split from its references.** `e2e-tests` declares
  `needs: [publish, dev-release]`. Renaming the job without renaming the three
  reference sites makes `actionlint` fail on an undefined `needs` target — a red gate,
  so it cannot be committed. Renaming the references first fails the same way. The
  rename is atomic by construction.
- **Deleting `cleanup` cannot be split from dropping `closed`.** Keeping `cleanup`
  while dropping `closed` from `pull_request` `types:` leaves a job that can never
  fire. Dropping `cleanup` while `dev-release` still creates `dev-pr-*` releases leaves
  them unreaped for the life of the intermediate commit. Both orderings are
  semantically broken; R3 states them as a single requirement for exactly this reason.
- **The R5 empty-URL assertion stays a step inside this part, not its own part.**
  Splitting it would land a `preview` job that passes actionlint and zizmor while the
  design's most important safety property is absent: an empty `urls` output makes
  `run-e2e-tests.yml` substitute its `default: latest-rc` and turn the whole nine-cell
  matrix green against the last published release instead of the PR build. A green gate
  over a commit with that hole is worse than a red one. It is also eight lines of shell
  appended to a step list this same part writes — it does not earn an agent lifecycle.

So: **one implementation part.** Two follow-on obligations belong to later phases and
are recorded below the part, not scheduled as parts — the R12 strip commit (propose
phase) and the things only a live PR run can observe.

## Part 1 — Replace the `dev-release` and `cleanup` jobs with a pkg.pr.new `preview` job

### Context

**Working directory:** `/Users/scolladon/workspace/perso/node/sf-git-merge-driver-pkg-pr-new-pr-previews`
(git worktree, branch `ci/pkg-pr-new-pr-previews`). Work only there.

**The only file this part touches:** `.github/workflows/npm-service.yml` (149 lines at
HEAD `194cd31`, 127 lines after). Nothing else changes **in this part** — not
`.github/workflows/run-e2e-tests.yml` (R6), not `package.json` (ADR 005 adds no
dependency), not `.github/linters/.cspell.json`, not `CONTRIBUTING.md` (it never
mentions the flow being removed). The tracked `docs/` tree on this branch is left
exactly as it is; removing it is the propose phase's job, described at the end of this
plan.

`node_modules/` is already installed in the worktree and `npm run lint` is green at
HEAD — you inherit no red baseline.

#### Repo idioms this file already follows — match them, do not invent

- `actions/checkout@v7` with `persist-credentials: false`.
- `./.github/actions/install` is the shared setup composite: it restores the npm cache
  via `actions/cache@v6` keyed on `hashFiles('**/package-lock.json')`, then runs
  `npm ci` with `HUSKY: '0'`.
- Actions are pinned to **version tags, never commit SHAs**. `.github/zizmor.yml`
  relaxes `unpinned-uses` to `ref-pin` precisely to permit that; Dependabot keeps the
  tags current. Do not SHA-pin anything.
- Fork detection idiom, already used at `.github/workflows/on-pull-request.yml:23`:
  `github.event.pull_request.head.repo.full_name == github.repository`.
- The workflow-level `permissions:` block carries an explanatory comment. Job-level
  blocks carry one **when they escalate** — see `.github/workflows/on-pull-request.yml`
  lines 168-170 for the in-repo example of a commented job-level escalation.
- Values interpolated into `run:` bodies go through `env:` first, never inline `${{ }}`
  inside the shell. The current file already does this (`RELEASE_TAG`, `PR_NUMBER`).

#### Hard constraints

- **No provenance refs in the workflow file.** No `R5`, no `ADR 003`, no phase numbers
  in any YAML comment. The design's abridged sketch annotates its steps with ADR
  numbers for the reader's benefit; those annotations must not survive into the file.
  Comments explain *why*, in their own terms.
- **No new suppression directive of any kind** (R11): no `# zizmor: ignore[...]`, no
  disabled rule, no lint-silencing comment. The two pre-existing `# zizmor:
  ignore[cache-poisoning]` comments — one in `publish` (survives), one in
  `dev-release` (leaves with the job) — are not touched.
- **The `publish` job is byte-identical** (R7). It occupies lines 23-52 both before and
  after; `sed -n '23,52p' .github/workflows/npm-service.yml | shasum` must read
  `c64730bd7e3feae8f00dbe7da814e4aa8652d6b9` at the end exactly as it does now.

#### Edit A — line 9, drop `closed` from the trigger types

Current line 9:

```yaml
    types: [opened, synchronize, reopened, closed]
```

Target:

```yaml
    types: [opened, synchronize, reopened]
```

Nothing consumes `pull_request: closed` once `cleanup` is gone (R3).

#### Edit B — lines 13-14, the workflow-level permissions comment

Current lines 13-14:

```yaml
# Least-privilege default; jobs that need more escalate explicitly
# (publish → id-token, dev-release/cleanup → contents/pull-requests).
```

Target:

```yaml
# Least-privilege default; jobs that need more escalate explicitly
# (publish → id-token, preview → pull-requests).
```

Two lines in, two lines out — the `permissions:` key stays on line 15.

#### Edit C — lines 54-142, replace both jobs with one

Lines 54-123 are the `dev-release` job, line 124 is blank, lines 125-142 are the
`cleanup` job. **Delete lines 54-142 inclusive and paste the block below in their
place.** Line 143 (blank) and line 144 (`  e2e-tests:`) survive as the following lines.

This block is verbatim and has already been run through `actionlint`, `zizmor@1.25.0`
and `cspell` in this exact form — paste it, do not paraphrase it. Step names are part
of the contract: the gate greps for `Assert a single preview URL` by name.

````yaml
  preview:
    if: >-
      github.event_name == 'pull_request' &&
      github.actor != 'dependabot[bot]'
    runs-on: ubuntu-latest
    outputs:
      channel: ${{ steps.preview.outputs.urls }}
    # `pull-requests: write` is for the install comment this job posts itself;
    # publishing the preview needs no write scope at all, which is what lets
    # pull requests from forks publish.
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v7
        with:
          persist-credentials: false
      # `./.github/actions/install` already restores the npm cache via
      # actions/cache@v6, so setup-node's own package-manager cache is
      # redundant here; disabling it also keeps this publishing workflow clear
      # of the cache-poisoning audit without a suppression.
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          package-manager-cache: false
      - uses: ./.github/actions/install

      - name: Build and pack
        id: pack
        run: |
          npm run build
          npm pack
          # Derive the tarball name from package.json rather than parsing
          # `npm pack` stdout: newer npm prints the filename to stderr, so
          # `npm pack 2>/dev/null | tail -1` silently yields an empty string.
          TARBALL=$(node -p "const p=require('./package.json'); p.name.replace('@','').replace('/','-')+'-'+p.version+'.tgz'")
          echo "tarball=$TARBALL" >> "$GITHUB_OUTPUT"

      - name: Publish preview
        id: preview
        env:
          TARBALL: ${{ steps.pack.outputs.tarball }}
        run: npx pkg-pr-new publish "./$TARBALL" --comment=off

      - name: Assert a single preview URL
        env:
          URLS: ${{ steps.preview.outputs.urls }}
        run: |
          # run-e2e-tests.yml defaults `channel` to latest-rc, so an empty URL
          # would turn the whole matrix green against the last release instead
          # of this build. Fail here rather than pass a malformed channel on.
          if [ "$(printf '%s' "$URLS" | wc -w)" -ne 1 ]; then
            echo "::error::expected exactly one preview URL, got '$URLS'"
            exit 1
          fi

      - name: Comment PR
        if: github.event.pull_request.head.repo.full_name == github.repository
        uses: thollander/actions-comment-pull-request@v3
        with:
          message: |
            Preview build published for this pull request.
            ```sh
            sf plugins install ${{ steps.preview.outputs.urls }}
            ```
          comment-tag: dev-publish
          mode: recreate
````

**Why each non-obvious line reads the way it does** — the design left these abridged,
they are resolved here:

- **`if:` loses `github.event.action != 'closed'`** because `closed` is no longer in
  `types:` (Edit A). It keeps `github.actor != 'dependabot[bot]'` — dependabot PRs
  still skip preview publishing and therefore still skip `e2e-tests` (R8).
- **`package-manager-cache: false` is load-bearing and is a fix, not a silencer.**
  `actions/setup-node@v7` enables package-manager caching by default. zizmor's
  `cache-poisoning` audit flags any `setup-node` in a workflow it classifies as a
  publisher, which this one is via its `release` trigger. Without this input the gate
  reports `error[cache-poisoning] … high` and fails. The input is also honest: the npm
  cache is already restored by `./.github/actions/install`, so setup-node's implicit
  cache is redundant. This is what satisfies R11 without a suppression.
- **`Build and pack` keeps `npm run build` ahead of `npm pack`.** Technically redundant
  — `npm pack` fires `prepack`, which wireit resolves to `build` + `build:bin` — but it
  keeps compile/lint failures reported as their own step, and the second invocation is
  a wireit cache hit (ADR 003).
- **The `package.json`-derived tarball name and its comment must survive verbatim.**
  Newer npm prints the pack filename to **stderr**, so the obvious
  `npm pack 2>/dev/null | tail -1` silently yields an empty string. That is why the
  name is computed from `package.json` instead. The comment records the reason; keep
  it.
- **The `mv` to `sf-git-merge-driver-dev-pr-<N>.tgz` is gone**, along with the step's
  `env: PR_NUMBER`. The rename existed only to name a release asset; pkg.pr.new reads
  the top-level `package.json` out of the tarball and uploads it as-is. Removing it is
  also what makes `grep -rn 'dev-pr' .github/` come back empty (R2).
- **`npx pkg-pr-new publish "./$TARBALL" --comment=off`** — a tarball argument, not a
  directory (ADR 003: the artifact is byte-identical to what `npm publish` would ship,
  R10); the CLI resolved from a floating `npx` with no version specifier and no
  `package.json` entry (ADR 005); the App's own `npm i <url>` comment suppressed in
  favour of the repository's own (ADR 001). **No secret is passed** — the CLI reads
  none; it authenticates the run through the GitHub App. That is precisely why fork PRs
  work (R9).
- **`Assert a single preview URL` must be its own step.** `steps.<id>.outputs.*` is not
  readable inside the step that writes it — GitHub evaluates the context before the
  step runs. Folding the assert into `Publish preview` would read an empty string every
  time. `wc -w` covers both failure modes R5 names with one comparison: `0` for empty,
  `≥2` for a multi-URL list.
- **`Comment PR` is gated, not permitted to fail.** A fork PR's `GITHUB_TOKEN` is
  read-only regardless of the `permissions:` block, so the step must be *skipped* on
  forks — otherwise a fork PR goes red on the comment after having published a
  perfectly good preview. Fork contributors read their URL off the `Continuous
  Releases` check run that pkg.pr.new creates unconditionally, and off the job log.
- **`comment-tag: dev-publish` stays exactly as it is.** ADR 001 names it verbatim, and
  keeping it means the action *recreates* the existing comment on any currently-open PR
  instead of adding a second one. It does not match `grep 'dev-pr'` (`dev-pu` ≠
  `dev-pr`), so R2 is unaffected — verified.
- **Concurrency is unchanged.** A superseded preview run is safe: the service guards
  its per-PR cursor writes on the run id.

#### Edit D — lines 144-149, propagate the rename into `e2e-tests`

Three sites, all in one job. **Missing any one of the three yields a silently skipped
e2e matrix — the single most likely mistake in this change.**

Current lines 144-149:

```yaml
  e2e-tests:
    needs: [publish, dev-release]
    if: "!cancelled() && (needs.publish.result == 'success' || needs.dev-release.result == 'success')"
    uses: ./.github/workflows/run-e2e-tests.yml
    with:
      channel: ${{ needs.publish.outputs.channel || needs.dev-release.outputs.channel }}
```

Target:

```yaml
  e2e-tests:
    needs: [publish, preview]
    if: "!cancelled() && (needs.publish.result == 'success' || needs.preview.result == 'success')"
    uses: ./.github/workflows/run-e2e-tests.yml
    with:
      channel: ${{ needs.publish.outputs.channel || needs.preview.outputs.channel }}
```

The two-path shape is deliberate (ADR 002: previews publish on `pull_request` only, no
`push: [main]`), so nothing here changes except the job name.

#### Public surface

None. This part introduces no exported symbol, no barrel entry, no command, no
generated API surface. The only externally-visible names it creates are the GitHub
Actions job id `preview` and the step ids `pack` / `preview`, all consumed inside this
one file and all covered by Edit D. There are no downstream surface gates to pre-pay.

#### Verified expectations — this exact target has already been gated

The target file above was assembled and run through all three checks in a throwaway
tree during planning. You should reproduce these results, not discover them:

| Check | At HEAD | After the edit |
|---|---|---|
| `actionlint` | silent, exit 0 | silent, exit 0 |
| `zizmor@1.25.0` | `No findings to report. Good job! (2 ignored, 7 suppressed)` | `No findings to report. Good job! (1 ignored, 4 suppressed)` |
| `cspell` over the file | 0 issues | 0 issues |
| `publish` lines 23-52 sha1 | `c64730bd7e3feae8f00dbe7da814e4aa8652d6b9` | unchanged |
| file length | 149 lines | 127 lines |
| `jobs:` / `publish:` / `preview:` / `e2e-tests:` start lines | 22 / 23 / — / 144 | 22 / 23 / 54 / 122 |

If your line numbers land elsewhere, an edit went in at the wrong offset — recheck
before running the rest of the gate.

The `ignored` count dropping `2 → 1` is the mechanical expression of R11: the
`dev-release` job's `cache-poisoning` suppression leaves with the job and the new job
adds none. **`No findings` alone is not sufficient — check the ignored count.**

`cspell` was additionally run against the target with `stackblitz` and `tsgit` removed
from `.github/linters/.cspell.json`: still 0 issues. That confirms the propose-phase
strip commit is safe and that the workflow file introduces no proper noun needing a
dictionary entry. Do not add one — and do not name `stackblitz-labs` or `tsgit` in any
comment you write, or that guarantee has to be re-established.

### TDD steps

There is no unit-test surface here — this is CI YAML, and inventing a test file for it
would be ceremony, not verification. What stands in for red-green is a set of
falsifiable assertions that **fail against HEAD today with known output** and must flip
after the edit. Run them *before* editing so you see them red.

**RED — run each against HEAD first; the stated current output is the expected
failure.**

1. `grep -n 'contents: write' .github/workflows/npm-service.yml`
   → currently prints `63:      contents: write` and `131:      contents: write`.
   Must print nothing (exit 1). **R1** — no `pull_request`-reachable job holds
   `contents: write`.
2. `grep -rn 'dev-pr' .github/`
   → currently 4 hits, all in `npm-service.yml`: lines 88, 99, 118, 138.
   Must print nothing. **R2** — nothing in the repository touches the `dev-pr-*`
   namespace any more.
3. `grep -n 'closed' .github/workflows/npm-service.yml` → currently lines 9, 57, 127;
   `grep -n '^  cleanup:' .github/workflows/npm-service.yml` → currently line 125.
   Both must print nothing. **R3** — the job and its trigger leave together.
4. `uvx zizmor@1.25.0 --offline --config .github/zizmor.yml .github/workflows/npm-service.yml`
   → currently `No findings to report. Good job! (2 ignored, 7 suppressed)`.
   Must report `No findings` with **`1 ignored`**. **R11**.
5. The rename, checked at all three sites — this is where two-of-three is the most
   likely mistake in the change, and it yields a silently skipped e2e matrix:
   - `grep -c 'dev-release' .github/workflows/npm-service.yml` → currently `5`
     (lines 14, 54, 145, 146, 149); must print `0`.
   - `grep -n '^  preview:' .github/workflows/npm-service.yml` → currently nothing;
     must print exactly one line.
   - `grep -q 'needs: \[publish, preview\]' .github/workflows/npm-service.yml` →
     currently fails; must succeed. That is site 1.
   - `grep -c 'needs\.preview\.' .github/workflows/npm-service.yml` → currently `0`;
     must print `2` — the `if:` result-check and the `channel:` expression, sites 2
     and 3. **R4 + semantic-review item 6.**
6. `grep -n 'Assert a single preview URL' .github/workflows/npm-service.yml`
   → currently nothing; must print one line, and it must sit **after** the step
   carrying `id: preview`. **R5.**
7. `sed -n '23,52p' .github/workflows/npm-service.yml | shasum`
   → currently `c64730bd7e3feae8f00dbe7da814e4aa8652d6b9`; must still be that.
   **R7** — this one is red-by-inversion: it passes now and must keep passing. Run it
   before and after and compare.
8. `git diff --no-ext-diff --name-only HEAD` → currently empty; after the edit must
   name `.github/workflows/npm-service.yml` **and nothing else**. **R6** (the e2e
   reusable workflow is absent from the diff) and the `package.json` /
   `.cspell.json` no-op.

**GREEN — apply Edits A, B, C, D above, in that order.** Nothing beyond them. Re-run
all eight assertions; every one flips to its target state.

**REFACTOR — a semantic pass over the resulting diff, then the full gate.**

- Read the diff and confirm the design's remaining semantic-review points, which the
  greps do not cover: `publish` is untouched (same steps, same `id-token: write`, same
  `--tag latest-rc`, same `channel` expression); the `preview` job declares exactly
  `contents: read` + `pull-requests: write`; `Comment PR` is *skipped* on forks rather
  than allowed to fail; the publish step passes a tarball, not a directory, with no
  version specifier; `github.actor != 'dependabot[bot]'` survived the `if:` rewrite.
- Confirm no YAML comment you wrote carries an ADR number, an R-number, or any other
  provenance ref, and that no suppression directive was added.
- Run the Gate below.

### Gate

Run from the worktree root, `/Users/scolladon/workspace/perso/node/sf-git-merge-driver-pkg-pr-new-pr-previews`:

```sh
actionlint .github/workflows/npm-service.yml \
  && uvx zizmor@1.25.0 --offline --config .github/zizmor.yml .github/workflows/npm-service.yml
```

Expected: `actionlint` silent, exit 0. `zizmor` prints
`No findings to report. Good job! (1 ignored, 4 suppressed)`, exit 0. **A `2 ignored`
here means a suppression survived that should not have — investigate before
committing, do not commit on it.**

Then the falsifiable assertions, which are part of this gate and not optional:

```sh
! grep -q 'contents: write' .github/workflows/npm-service.yml \
  && ! grep -rq 'dev-pr' .github/ \
  && ! grep -q 'closed' .github/workflows/npm-service.yml \
  && [ "$(sed -n '23,52p' .github/workflows/npm-service.yml | shasum | cut -d' ' -f1)" = c64730bd7e3feae8f00dbe7da814e4aa8652d6b9 ] \
  && [ "$(grep -c 'needs\.preview\.' .github/workflows/npm-service.yml)" = 2 ] \
  && [ "$(git diff --no-ext-diff --name-only HEAD)" = '.github/workflows/npm-service.yml' ] \
  && echo GATE-OK
```

Expected: `GATE-OK`.

Phase gate (run once after this part, since it is the only part):

```sh
npx --yes cspell@9 --config .github/linters/.cspell.json .github/workflows/npm-service.yml \
  && npm run lint
```

Expected: `CSpell: Files checked: 1, Issues found: 0 in 0 files.`, then Biome
`Checked <n> files … No fixes applied.` and wireit's `✅ Ran 1 script`. `npm run lint`
covers `src`/`test`, which this change does not touch — it is green at HEAD and is
included because it is the repo's standard phase gate and must stay green.

Note `npm run lint` is wireit-driven and writes to the gitignored `.wireit/` cache.
That is expected and is not a working-tree change: `git status --short` must still
show `.github/workflows/npm-service.yml` as the only modification.

### Commit

```
ci: publish PR previews with pkg.pr.new instead of per-PR draft releases
```

One commit, `.github/workflows/npm-service.yml` only. Do not `git add` anything else,
and do not use `--no-verify`.

## Propose-phase obligation — the R12 strip commit

**Not a part. Do not schedule an implementer for it.** It happens at the propose phase,
immediately before the pull request is opened, so that craft's artifact handoff holds
for the whole run and the PR still carries only the workflow change (ADR 006).

Its exact content, so the propose phase does not have to re-derive it:

1. `git rm -r --cached`-and-delete these eight tracked paths (all added on this branch,
   all under the repository's `docs/`-is-local-only convention in `.git/info/exclude`):
   `docs/design/pkg-pr-new-pr-previews.md`, `docs/adr/001-pr-preview-comment-strategy.md`
   through `docs/adr/006-craft-artifacts-stay-local.md`, and `docs/plan/pkg-pr-new-pr-previews.md`.
   Copy them into the main checkout's untracked `docs/` first so they survive locally.
2. Remove the two words from `.github/linters/.cspell.json` — `stackblitz` (line 67 at
   HEAD) and `tsgit` (line 70). Both were added in commit `554fe32`, the same commit as
   the design document, **solely** for words appearing in the design doc and ADRs 002
   and 005. Verified: after removal, no tracked file needs either, and the new workflow
   file passes cspell without them.
3. Post-conditions, both checkable:
   - `git diff --name-only main...HEAD` names `.github/workflows/npm-service.yml` and
     nothing else. `.github/linters/.cspell.json` does not appear because the added and
     removed words cancel against `main`.
   - `npx --yes cspell@9 --config .github/linters/.cspell.json` over the tracked tree
     reports 0 issues.

One consequence of the strip commit is load-bearing and easy to miss: the workflow
retains `paths-ignore: "**.md"`, so a markdown-only pull request triggers no preview and
no e2e. After the strip commit the branch carries `.github/workflows/npm-service.yml`
and no markdown at all, so **this** pull request does trigger the workflow on itself —
which is the only way the first-run observations below happen. Strip first, then open
the PR; opening it while the docs are still on the branch does not change the trigger
(the workflow file is not markdown), but leaving them on the branch violates R12.

The rationale a reviewer needs — the `contents: write` removal, the fork-PR gain, the
floating-`npx` trade-off, and the manual `dev-pr-*` follow-up — goes in the **PR body**,
because there will be no committed document to point at. Two further items belong in
that body: the `dev-pr-205` and `dev-pr-207` releases and their tags are deleted **by
hand at merge time**, not on this branch, because both PRs are still open and their
assets are live (ADR 004); and the pkg.pr.new GitHub App must be installed on
`scolladon/sf-git-merge-driver` before the first PR run or `preview` fails with a
`Check failed (404): the app … is not installed` diagnostic.

## Only observable on the first real PR run

Stated plainly rather than dressed up as something the part gate can prove. None of
these blocks the part; all of them are checks for whoever watches the first run.

- **The preview publishes and the URL shape is right.** The `preview` job green, the log
  showing `npm notice … .tgz` from pack followed by a compact
  `pkg.pr.new/sf-git-merge-driver@<7 hex>` URL. The long
  `pkg.pr.new/<owner>/<repo>/<pkg>@<full-sha>` form is also valid — the CLI falls back
  to it and logs `Falling back to non-compact URLs for this run`.
- **A `Continuous Releases` check run appears on the PR.** This is the signal that the
  GitHub App is installed and authenticated. Its absence together with a
  `Check failed (404)` in the log is the App-not-installed diagnosis.
- **All nine `e2e-tests` cells run and each `sf plugins install "$CHANNEL"` succeeds.**
  This is the single most important assertion in the whole change and the only
  end-to-end evidence against the real service. Watch Windows — that is where this repo
  has historically found install-path divergence. Read the job log for the URL it
  actually installed, not just the step's green tick: R5 exists because a green matrix
  can otherwise mean `latest-rc` was tested.
- **No new tag or release appears on the repository during or after the run** (R2).
- **R9 — fork behaviour — cannot be proven from an internal PR at all.** Either accept
  it on the strength of the CLI reading no `GITHUB_TOKEN`, and verify opportunistically
  on the next external contribution; or push the branch to a scratch fork and open a
  throwaway PR against `main`. The latter is cheap and turns the headline benefit of
  this change from an argument into an observation. Either way, check first that
  *Require approval for all external contributors* is enabled on the repository — that
  setting is the control the newly-enabled fork path relies on, and it is repository
  configuration, not anything expressible in the workflow file.
