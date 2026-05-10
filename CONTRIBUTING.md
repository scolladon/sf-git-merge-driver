# Contributing to sf-git-merge-driver

We encourage the developer community to contribute to this repository. This guide has instructions to install, build, test and contribute to the framework.

- [Requirements](#requirements)
- [Installation](#installation)
- [Testing](#testing)
- [Git Workflow](#git-workflow)

## Requirements

- [Node](https://nodejs.org/) >= 20
- [npm](https://www.npmjs.com/) >= 10.9.0

## Installation

### 1) Download the repository

```bash
git clone git@github.com:scolladon/sf-git-merge-driver.git
```

### 2) Install Dependencies

This will install all the tools needed to contribute

```bash
npm install
```

### 3) Build application

```bash
npm pack
```

Rebuild every time you made a change in the source and you need to test locally

## Testing

### Unit Testing

When developing, use [vitest](https://vitest.dev/) unit testing to provide test coverage for new functionality. Coverage thresholds are enforced at 100% for branches / functions / lines / statements (see `vitest.config.ts`).

```bash
# just run test
npm run test:unit
```

To execute a particular test file, use the following command:

```bash
npx vitest run <path_to_test>
```

### Mutation Testing

Run Stryker to validate that tests actually catch mutations:

```bash
npm run test:mutation             # full run
npm run test:mutation:incremental # faster re-runs
```

### NUT Testing

When developing, use mocha testing to provide NUT (Not Unit Test) functional coverage for the CLI surface. To run the mocha tests use the following command from the root directory:

```bash
# run test
npm run test:nut
```

### E2E Testing

sf-git-merge-driver has E2E executed at the PR level.
Those test are located in the branch `e2e/base` and `e2e/conflict`
Base scenario are implemented in `e2e/base` branch
Conflict scenario are implemented in `e2e/conflict`

To run the E2E test locally, clone the repository in another folder (in the `e2e` folder local to the repo for example) and checkout the branch `e2e/base`
Then execute:

```bash
# setup the repo
mkdir e2e
git clone git@github.com:scolladon/sf-git-merge-driver.git e2e
cd e2e
git fetch

# setup branches
git checkout e2e/conflict
git checkout e2e/base

# run the test
git merge -m 'test(e2e): sf git merge driver' e2e/conflict
```

## Editor Configurations

Configure your editor to use our lint and code style rules.

### Code formatting

[Biome](https://biomejs.dev/) Format, lint, and more in a fraction of a second.

### Code linting

[Biome](https://biomejs.dev/) Format, lint, and more in a fraction of a second.

### Commit linting

This repository uses [Commitlint](https://github.com/conventional-changelog/commitlint) to check our commit convention.
Pre-commit git hook using husky and pull request check both the commit convention for each commit in a branch.

You can use an interactive command line to help you create supported commit message

```bash
npm run commit
```

### PR linting

When a PR is ready for merge we use the PR name to create the squash and merge commit message.
We use the commit convention to auto-generate the content and the type of each release
It needs to follow our commit lint convention and it will be check at the PR level

## Git Workflow

The process of submitting a pull request is straightforward and
generally follows the same pattern each time:

1. [Fork the repo](#fork-the-repo)
2. [Create a feature branch](#create-a-feature-branch)
3. [Make your changes](#make-your-changes)
4. [Rebase](#rebase)
5. [Check your submission](#check-your-submission)
6. [Create a pull request](#create-a-pull-request)
7. [Update the pull request](#update-the-pull-request)

### Fork the repo

[Fork](https://help.github.com/en/articles/fork-a-repo) the [scolladon/sf-git-merge-driver](https://github.com/scolladon/sf-git-merge-driver) repo. Clone your fork in your local workspace and [configure](https://help.github.com/en/articles/configuring-a-remote-for-a-fork) your remote repository settings.

```bash
git clone git@github.com:<YOUR-USERNAME>/sf-git-merge-driver.git
cd sf-git-merge-driver
git remote add upstream git@github.com:scolladon/sf-git-merge-driver.git
```

### Create a feature branch

```bash
git checkout main
git pull origin main
git checkout -b feature/<name-of-the-feature>
```

### Make your changes

Change the files, build, test, lint and commit your code using the following command:

```bash
git add <path/to/file/to/commit>
git commit ...
git push origin feature/<name-of-the-feature>
```

Commit your changes using a descriptive commit message

The above commands will commit the files into your feature branch. You can keep
pushing new changes into the same branch until you are ready to create a pull
request.

### Rebase

Sometimes your feature branch will get stale on the main branch,
and it will must a rebase. Do not use the github UI rebase to keep your commits signed. The following steps can help:

```bash
git checkout main
git pull upstream main
git checkout feature/<name-of-the-feature>
git rebase upstream/main
```

_note: If no conflicts arise, these commands will apply your changes on top of the main branch. Resolve any conflicts._

### Check your submission

#### Lint your changes

```bash
npm run lint
```

The above command may display lint issues not related to your changes.
The recommended way to avoid lint issues is to [configure your
editor](https://biomejs.dev/guides/integrate-in-vcs/) to warn you in real time as you edit the file.

the plugin lint all those things :

- typescript files
- folder structure
- plugin parameters
- plugin output
- dependencies
- dead code / configuration

Fixing all existing lint issues is a tedious task so please pitch in by fixing
the ones related to the files you make changes to!

#### Run tests

Test your change by running the unit tests and integration tests. Instructions [here](#testing).

### Create a pull request

If you've never created a pull request before, follow [these
instructions](https://help.github.com/articles/creating-a-pull-request/). Pull request samples [here](https://github.com/scolladon/sfdx-git-delta/pulls)

### Update the pull request

```bash
git fetch origin
git rebase origin/${base_branch}

# Then force push it
git push origin ${feature_branch} --force-with-lease
```

_note: If your pull request needs more changes, keep working on your feature branch as described above._

CI validates prettifying, linting and tests

### Collaborate on the pull request

We use [Conventional Comments](https://conventionalcomments.org/) to ensure every comment expresses the intention and is easy to understand.
Pull Request comments are not enforced, it is more a way to help the reviewers and contributors to collaborate on the pull request.

## Adding a new metadata key extractor

The merge driver matches array elements across `ancestor` / `local` / `other` versions by extracting a stable key from each element. Key extractors live in the `METADATA_KEY_EXTRACTORS` table in `src/service/MetadataService.ts`.

### Where to add it

1. Add the entry to `METADATA_KEY_EXTRACTORS` keyed by the XML element name.
2. The value is a function `(el: JsonValue) => string` returning a stable key. Trailing comment should list the parent schema(s) the element belongs to (matching the existing convention).

### Single-key extractor

```typescript
foo: (el: JsonValue) => getPropertyValue(el, 'name'), // SomeMetadataType
```

### Composite-key extractor (multiple fields joined)

When the key is a composite of multiple fields, use the `String(undefined)` sentinel idiom to filter out missing properties — see `getFilterItemKey`, `getCaseValuesKey`, etc. for canonical examples.

### Element name reused across schemas (prefer-then-fallback)

If the XML element name already exists in the table for a different parent schema with a different key field, **do not overwrite** — extract a named helper that prefers one key and falls back to the other. See `getPicklistValuesKey` for the canonical example, and the "Shared element names across schemas" subsection of [DESIGN.md](./DESIGN.md) for the list of currently-known cases.

> **Why this matters:** if both schemas hit the single-key path with different field names, every block in the wrong-schema document will key to the literal string `"undefined"` and `buildKeyedMap` will silently retain only the last entry — a silent data-loss bug class.

### Required test layering

Every new extractor must ship with:

1. **Unit test** in `test/unit/service/MetadataService.test.ts` — at least one case per key path (including each fallback branch when applicable).
2. **Integration test** in `test/integration/XmlMerger.test.ts` — at least one end-to-end three-way merge that would regress to data loss if the extractor returned `"undefined"`.

### Mutation testing

After adding an extractor, run Stryker scoped to the file to verify the new tests actually kill the obvious mutants:

```bash
./node_modules/.bin/stryker run --incremental \
  --incrementalFile reports/mutation/stryker-incremental.json \
  --mutate "src/service/MetadataService.ts"
```

The PR-touched lines should reach 100% mutation score before submitting.

## CLI parameters convention

The plugins uses [sf cli parameters convention](https://github.com/salesforcecli/cli/wiki/Design-Guidelines-Flags) to define parameters for the CLI.

## Testing the plugin from a pull request

To test SGD as a Salesforce CLI plugin from a pending pull request:

1. locate the comment with the beta version published in the pull request
2. install the beta version `sf plugins install sf-git-merge-driver@<beta-channel>`
3. test the plugin!

## How to modify npm tags

Execute the npm script `npm run devops:move-tag -- <version> <tag>`
Ex: `npm run devops:move-tag -- 1.0.0 stable`

Use it to move tags to a version, for example to move `stable` and `latest` tags to a new version.
Or to downgrade `latest-rc` tag to a previous version.

## How to cleanup dev tags

Execute the npm script `npm run devops:cleanup:dev-tag -- <dev-tag> <otp>` to clean up a single dev tag.
Ex: `npm run devops:cleanup:dev-tag -- dev-101 123456`

To clean up **all** dev tags at once: `npm run devops:cleanup:dev-tag:all -- <otp>`

Both will deprecate all versions related to the dev tag(s) and remove the dist-tag(s) from the npm registry.
