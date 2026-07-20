---
title: Versioning & Releases
description: How Nametag handles version numbers and releases.
sidebar:
  order: 3
---

Nametag follows [Semantic Versioning 2.0.0](https://semver.org/).

## Version format

`MAJOR.MINOR.PATCH` (for example, `1.2.3`).

- **MAJOR**: breaking changes (incompatible API changes, database migrations requiring manual intervention).
- **MINOR**: new features, backward-compatible.
- **PATCH**: bug fixes, backward-compatible.

Pre-release versions may use suffixes: `1.0.0-beta.1`, `1.0.0-rc.2`.

## Conventional commits

Nametag uses [Conventional Commits](https://www.conventionalcommits.org/) to automatically determine version bumps.

**Format:**

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat:` new feature (triggers a MINOR bump)
- `fix:` bug fix (triggers a PATCH bump)
- `perf:` performance improvement (triggers a PATCH bump)
- `docs:` documentation changes only
- `style:` code style changes (formatting, semicolons, and so on)
- `refactor:` code restructuring without feature changes
- `test:` adding or updating tests
- `chore:` maintenance tasks, dependencies, and so on
- `ci:` CI/CD configuration changes

**Breaking changes:**

Add `BREAKING CHANGE:` in the footer, or `!` after the type, to trigger a MAJOR bump:

```text
feat!: redesign authentication system

BREAKING CHANGE: Users must re-authenticate after upgrade
```

## How releases work

Nametag uses [release-please](https://github.com/googleapis/release-please) for automated, PR-based releases.

1. Commits land on `master` using conventional commit format.
2. release-please automatically maintains an open **Release PR** that accumulates all unreleased changes, auto-suggests the next version based on commit types, updates `CHANGELOG.md` with grouped entries, and bumps the `package.json` version.
3. An AI step generates a human-readable release summary in the PR body.
4. A maintainer reviews and edits the PR: adjusting the version, rewriting the notes, or accepting it as-is.
5. Merging the PR creates the release: a git tag and a GitHub Release.
6. The release triggers Docker image builds and publishing automatically.

### Controlling versions

**Auto-determined:** release-please picks the version from commit types, using the same rules as the table below.

**Override the version:** add a commit with this footer to force a specific version:

```text
chore: prepare for v1.0.0 release

Release-As: 1.0.0
```

**Skip a release:** simply don't merge the Release PR. It keeps accumulating changes until it's merged.

### Version bumping rules

| Commit type | Version bump | Example |
| --- | --- | --- |
| `fix:` | PATCH | 1.0.0 to 1.0.1 |
| `feat:` | MINOR | 1.0.0 to 1.1.0 |
| `feat!:` or `BREAKING CHANGE:` | MAJOR | 1.0.0 to 2.0.0 |
| `docs:`, `style:`, `refactor:`, `test:`, `chore:` | No bump | (none) |

While the version is `0.x.y` (pre-1.0), breaking changes bump MINOR instead of MAJOR.

## Version history

Versions are tracked in:

- `package.json`, the npm package version.
- `.release-please-manifest.json`, the release-please version tracker.
- Git tags, `v1.2.3`.
- GitHub Releases, with release notes and changelog.
- Docker tags, `ghcr.io/mattogodoy/nametag:1.2.3` and `latest`.

## Where the version is displayed

The current version is shown in:

- The app footer, on every page.
- Settings > About.
- Docker image tags.
- The GitHub Releases page.

## Changelog

`CHANGELOG.md` is maintained automatically by release-please from commit messages, updated as part of the Release PR.

## Best practices

1. Write good commit messages. They become your changelog.
2. Use conventional commits. This is what enables the automation.
3. Tag breaking changes explicitly, with `!` or `BREAKING CHANGE:`.
4. Don't commit directly to `master`. Use PRs.
5. Squash related commits, one feature per commit.
6. Test before releasing: `npm run verify` runs all the checks.
