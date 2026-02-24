# Release System Overhaul

**Date**: 2026-02-24
**Status**: Approved

## Problem

The current release system auto-publishes on every push to master with no opportunity to review or adjust the version or release notes before they go live. Release notes are raw commit dumps that lack context, include noise, and require manual editing after the fact.

## Solution

Replace release-it + auto-changelog with **release-please** (PR-based release flow) and **GitHub Models** (AI-generated release summaries).

## Core Flow

1. Push commits to master using conventional commits (`feat:`, `fix:`, etc.)
2. release-please maintains an open Release PR that accumulates unreleased changes, auto-suggests the version, updates `CHANGELOG.md`, and bumps `package.json`
3. A GitHub Actions step calls GitHub Models to generate a human-readable release summary and adds it to the PR body
4. Review the PR: edit the version (via `Release-As:` commit footer), rewrite the notes, or accept as-is
5. Merging the PR creates the git tag + GitHub Release, which triggers Docker build + publish
6. Skip a release by not merging the PR

## Workflow Architecture

### Workflow 1: `release-please.yml` (on push to master)

**Job 1: release-please**
- Uses `googleapis/release-please-action@v4` with `release-type: node`
- Creates or updates the Release PR
- Outputs whether a release was created (for triggering publish)

**Job 2: ai-release-notes**
- Runs when the Release PR is created or updated
- Extracts commits between previous tag and HEAD
- Gets diffs for meaningful commits (excludes `chore:`, `ci:`, `docs:`)
- Calls GitHub Models via `actions/ai-inference` to generate a user-facing summary
- Places the AI draft at the top of the PR body, above release-please's structured changelog
- Falls back gracefully if AI step fails (release PR still works with standard changelog)

### Workflow 2: `publish.yml` (on release created)

**Job 1: verify** — lint, typecheck, tests, build

**Job 2: build-images** — Docker images for amd64 + arm64

**Job 3: create-manifest** — Multi-arch Docker manifest + tags (version, latest, SHA, timestamp)

## AI Release Notes

The prompt instructs the model to:
- Group changes by theme (e.g., "CardDAV Sync Improvements") not by commit type
- Write from the user's perspective (what's new, what's fixed, what changed)
- Keep it concise (3-8 bullet points for a typical release)
- Highlight breaking changes prominently

Model: GPT-4o-mini via GitHub Models. Uses `GITHUB_TOKEN` with `models: read` permission. No extra API keys.

## Version Control

- **Auto-suggestion**: release-please determines version from conventional commits (same rules as today: `feat:` = minor, `fix:`/`perf:` = patch, `!` or `BREAKING CHANGE:` = major)
- **Override**: Add a commit with footer `Release-As: X.Y.Z` to force a specific version
- **Skip**: Don't merge the Release PR. Or use non-triggering commit types (`chore:`, `docs:`, `ci:`)

## Configuration Files

### `release-please-config.json`
```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "bump-minor-pre-major": true,
  "bump-patch-for-minor-pre-major": false,
  "include-v-in-tag": true,
  "changelog-sections": [
    { "type": "feat", "section": "Features" },
    { "type": "fix", "section": "Bug Fixes" },
    { "type": "perf", "section": "Performance" },
    { "type": "docs", "section": "Documentation", "hidden": true },
    { "type": "chore", "section": "Miscellaneous", "hidden": true },
    { "type": "refactor", "section": "Refactoring", "hidden": true },
    { "type": "test", "section": "Tests", "hidden": true },
    { "type": "build", "section": "Build", "hidden": true },
    { "type": "ci", "section": "CI", "hidden": true },
    { "type": "style", "section": "Styles", "hidden": true }
  ]
}
```

### `.release-please-manifest.json`
```json
{
  ".": "0.19.0"
}
```

## Migration

### Removed
- `release-it`, `@release-it/conventional-changelog`, `auto-changelog` npm packages
- `.release-it.json`
- `scripts/generate-release-notes.sh`
- npm scripts: `release`, `release:dry`, `release:patch`, `release:minor`, `release:major`, `changelog`
- `.github/workflows/release.yml`

### Added
- `release-please-config.json`
- `.release-please-manifest.json`
- `.github/workflows/release-please.yml`
- `.github/workflows/publish.yml`

### Updated
- `docs/VERSIONING.md` — reflect new process
- `CLAUDE.md` — update release commands section

### Unchanged
- Conventional commit format
- Docker build/publish logic (moved to separate workflow)
- `pr-checks.yml`

### Cleanup
- `fix/releases-token` branch can be deleted (workflow being replaced)
