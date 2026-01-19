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
- `docs:` - Documentation changes only
- `style:` - Code style changes (formatting, semicolons, etc.)
- `refactor:` - Code refactoring without feature changes
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks, dependencies, etc.
- `ci:` - CI/CD configuration changes

### Breaking Changes

Add `BREAKING CHANGE:` in the footer or `!` after the type to trigger a MAJOR bump:

```
feat!: redesign authentication system

BREAKING CHANGE: Users must re-authenticate after upgrade
```

### Examples

```bash
# Patch bump (0.1.0 → 0.1.1)
git commit -m "fix: resolve birthday reminder timezone issue"

# Minor bump (0.1.0 → 0.2.0)
git commit -m "feat: add CSV export for contacts"

# Major bump (0.1.0 → 1.0.0)
git commit -m "feat!: migrate to new database schema

BREAKING CHANGE: Requires database migration. See UPGRADE.md for instructions."
```

## How to Release

### Option 1: Automated (Recommended)

Releases are automatically created when you push to `master`:

1. Make sure all commits follow Conventional Commits format
2. Merge your PR to `master`
3. GitHub Actions will:
   - Analyze commits since last release
   - Determine version bump (major/minor/patch)
   - Update `package.json` version
   - Generate CHANGELOG.md
   - Create Git tag
   - Create GitHub Release
   - Build and push Docker image with version tag

### Option 2: Manual

If you need to create a release manually:

```bash
# Install release tool
npm install -g release-it

# Preview what will happen (dry run)
npm run release -- --dry-run

# Create release (interactive)
npm run release

# Or specify version explicitly
npm run release -- 1.2.3
```

## Version History

Versions are tracked in:

- `package.json` - npm package version
- Git tags - `v1.2.3`
- GitHub Releases - Release notes with changelog
- Docker tags - `ghcr.io/mattogodoy/nametag:1.2.3` and `latest`

## Where Version is Displayed

The current version is shown in:

- App footer (all pages)
- Settings > About page
- Docker image tags
- GitHub Releases page

## Pre-releases

For beta/RC releases before major versions:

```bash
# Create beta release
npm run release -- --preRelease=beta
# Result: 1.0.0-beta.1

# Create release candidate
npm run release -- --preRelease=rc
# Result: 1.0.0-rc.1

# Graduate to stable
npm run release
# Result: 1.0.0
```

## Changelog

The `CHANGELOG.md` file is automatically generated from commit messages. To manually edit:

1. Generate changelog: `npm run changelog`
2. Edit `CHANGELOG.md` if needed
3. Commit changes

## Version Bumping Rules

| Commit Type                                       | Version Bump | Example       |
| ------------------------------------------------- | ------------ | ------------- |
| `fix:`                                            | PATCH        | 1.0.0 → 1.0.1 |
| `feat:`                                           | MINOR        | 1.0.0 → 1.1.0 |
| `feat!:` or `BREAKING CHANGE:`                    | MAJOR        | 1.0.0 → 2.0.0 |
| `docs:`, `style:`, `refactor:`, `test:`, `chore:` | No bump      | -             |

## Best Practices

1. **Write good commit messages** - They become your changelog
2. **Use conventional commits** - Enables automation
3. **Tag breaking changes explicitly** - Use `!` or `BREAKING CHANGE:`
4. **Don't commit directly to master** - Use PRs
5. **Squash related commits** - One feature = one commit
6. **Test before releasing** - Run `npm test` and `npm run build`

## Troubleshooting

**Q: I forgot to use conventional commits. Can I still release?**
A: Yes, but you'll need to manually specify the version bump. Use `npm run release -- major|minor|patch`

**Q: Can I edit the changelog before releasing?**
A: Yes, run the release in dry-run mode, edit CHANGELOG.md, then release.

**Q: What if I need to revert a release?**
A: Delete the Git tag, GitHub release, and Docker image tag. Then fix the issue and re-release.

**Q: Should I include version numbers in commits?**
A: No, version numbers are determined automatically from commit types.

## Migration from Current Version

Currently at `0.1.0`. When ready to go stable:

1. Complete all planned features for 1.0
2. Fix critical bugs
3. Write migration guide if needed
4. Create release: `npm run release -- 1.0.0`
5. Announce on website, socials, etc.
