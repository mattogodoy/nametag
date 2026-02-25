# Semantic Versioning Guide

Nametag follows [Semantic Versioning 2.0.0](https://semver.org/).

## Version Format

`MAJOR.MINOR.PATCH` (e.g., `1.2.3`)

- **MAJOR**: Breaking changes (incompatible API changes, database migrations requiring manual intervention)
- **MINOR**: New features (backward-compatible functionality)
- **PATCH**: Bug fixes (backward-compatible fixes)

Pre-release versions may use suffixes: `1.0.0-beta.1`, `1.0.0-rc.2`

## Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) to automatically determine version bumps.

### Commit Message Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat:` - New feature (triggers MINOR bump)
- `fix:` - Bug fix (triggers PATCH bump)
- `perf:` - Performance improvements (triggers PATCH bump)
- `docs:` - Documentation changes only
- `style:` - Code style changes (formatting, semicolons, etc.)
- `refactor:` - Code refactoring without feature changes
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependencies, etc.
- `ci:` - CI/CD configuration changes

### Breaking Changes

Add `BREAKING CHANGE:` in the footer or `!` after the type to trigger a MAJOR bump:

```
feat!: redesign authentication system

BREAKING CHANGE: Users must re-authenticate after upgrade
```

## How Releases Work

Nametag uses [release-please](https://github.com/googleapis/release-please) for automated, PR-based releases.

### Automatic Flow

1. Push commits to `master` using conventional commit format
2. release-please automatically maintains an open **Release PR** that:
   - Accumulates all unreleased changes
   - Auto-suggests the next version based on commit types
   - Updates `CHANGELOG.md` with grouped entries
   - Bumps `package.json` version
3. An AI step generates a human-readable release summary in the PR body
4. Review and edit the PR: adjust the version, rewrite the notes, or accept as-is
5. **Merge the PR** to create the release (git tag + GitHub Release)
6. The release triggers Docker image builds and publishing automatically

### Controlling Versions

**Auto-determined:** release-please picks the version from commit types (same rules as the table below).

**Override the version:** Add a commit with this footer to force a specific version:
```
chore: prepare for v1.0.0 release

Release-As: 1.0.0
```

**Skip a release:** Simply don't merge the Release PR. It keeps accumulating changes.

### Version Bumping Rules

| Commit Type                                       | Version Bump | Example        |
| ------------------------------------------------- | ------------ | -------------- |
| `fix:`                                            | PATCH        | 1.0.0 → 1.0.1 |
| `feat:`                                           | MINOR        | 1.0.0 → 1.1.0 |
| `feat!:` or `BREAKING CHANGE:`                    | MAJOR        | 1.0.0 → 2.0.0 |
| `docs:`, `style:`, `refactor:`, `test:`, `chore:` | No bump      | -              |

> **Note:** While the version is `0.x.y` (pre-1.0), breaking changes bump MINOR instead of MAJOR.

## Version History

Versions are tracked in:

- `package.json` - npm package version
- `.release-please-manifest.json` - release-please version tracker
- Git tags - `v1.2.3`
- GitHub Releases - Release notes with changelog
- Docker tags - `ghcr.io/mattogodoy/nametag:1.2.3` and `latest`

## Where Version is Displayed

The current version is shown in:

- App footer (all pages)
- Settings > About page
- Docker image tags
- GitHub Releases page

## Changelog

The `CHANGELOG.md` file is automatically maintained by release-please from commit messages. It is updated as part of the Release PR.

## Best Practices

1. **Write good commit messages** - They become your changelog
2. **Use conventional commits** - Enables automation
3. **Tag breaking changes explicitly** - Use `!` or `BREAKING CHANGE:`
4. **Don't commit directly to master** - Use PRs
5. **Squash related commits** - One feature = one commit
6. **Test before releasing** - `npm run verify` runs all checks
