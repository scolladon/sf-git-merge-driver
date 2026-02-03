# NPM Trusted Publisher Migration

## Problem

Multiple GitHub Actions workflows interact with npm (publish, dist-tag, deprecate), but npm's trusted publisher only allows configuring ONE workflow file path. The current approach using granular tokens is outdated and less secure.

## Solution

Consolidate all npm operations into a single `npm-publisher.yml` workflow triggered via `repository_dispatch` events. Other workflows become orchestrators that dispatch to this central workflow.

## Architecture

```
┌─────────────────────┐     repository_dispatch     ┌──────────────────────┐
│  on-main-push.yml   │ ──────────────────────────► │                      │
├─────────────────────┤                             │                      │
│  on-pull-request.yml│ ──────────────────────────► │  npm-publisher.yml   │
├─────────────────────┤                             │  (trusted publisher) │
│  on-merged-pr.yml   │ ──────────────────────────► │                      │
├─────────────────────┤                             │                      │
│  workflow_dispatch  │ ──────────────────────────► │                      │
└─────────────────────┘                             └──────────────────────┘
```

## Event Types

| Event Type | Payload | Use Case |
|------------|---------|----------|
| `npm-publish-release` | `{tag: "latest-rc"}` | Release publish |
| `npm-publish-dev` | `{dev_channel: "dev-123"}` | PR dev publish |
| `npm-dist-tag-add` | `{version: "1.4.1", tag: "latest"}` | Add/move tag |
| `npm-dist-tag-rm` | `{tag: "dev-123"}` | Remove tag |
| `npm-deprecate` | `{version: "1.4.0", message: "..."}` | Deprecate |

## npm-publisher.yml Structure

- Triggered by `repository_dispatch` (5 event types) and `workflow_dispatch` (manual ops)
- Permissions: `contents: read`, `id-token: write`
- 5 jobs with conditions based on event type
- All publish operations use `--provenance` flag

## Calling Workflow Changes

### on-main-push.yml
- Release job dispatches `npm-publish-release` instead of running `npm publish`

### on-pull-request.yml
- Dispatches `npm-publish-dev`
- Waits for npm-publisher workflow to complete
- Posts PR comment after successful publish

### on-merged-pull-request.yml
- Dispatches `npm-dist-tag-rm` and `npm-deprecate` for cleanup
- Keeps PR comment deletion

## Files to Delete

- `manual-deprecate-versions.yml` - replaced by workflow_dispatch in npm-publisher.yml
- `manual-manage-versions.yml` - replaced by workflow_dispatch in npm-publisher.yml

## npm Configuration

Configure trusted publisher on npmjs.com:
- Repository: `scolladon/sf-git-merge-driver`
- Workflow file: `.github/workflows/npm-publisher.yml`
