# Release System Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the auto-release-on-push system (release-it + auto-changelog) with a PR-based release flow (release-please) that includes AI-generated release summaries via GitHub Models.

**Architecture:** Two GitHub Actions workflows: (1) `release-please.yml` manages a Release PR with auto-versioning and AI-generated notes, (2) `publish.yml` triggers on release creation to build/push Docker images. Old tooling (release-it, auto-changelog) is fully removed.

**Tech Stack:** release-please (googleapis/release-please-action@v4), GitHub Models (actions/ai-inference), GitHub Actions

---

### Task 1: Add release-please configuration files

**Files:**
- Create: `release-please-config.json`
- Create: `.release-please-manifest.json`

**Step 1: Create release-please-config.json**

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
  ],
  "packages": {
    ".": {}
  }
}
```

**Notes:**
- `bump-minor-pre-major: true` means while version is `0.x.y`, breaking changes bump minor instead of major. This matches the current pre-1.0 behavior.
- `include-v-in-tag: true` keeps the existing `v0.19.0` tag format.
- The `packages` key with `"."` tells release-please this is a single-package repo at root.
- The `changelog-sections` match the existing `.release-it.json` section config (same hidden/visible types).

**Step 2: Create .release-please-manifest.json**

```json
{
  ".": "0.19.0"
}
```

**Notes:**
- This tells release-please the current version is `0.19.0`, matching `package.json`.
- release-please uses this to calculate the next version from conventional commits since the last release.

**Step 3: Commit**

```bash
git add release-please-config.json .release-please-manifest.json
git commit -m "chore: add release-please configuration files"
```

---

### Task 2: Create the release-please workflow

**Files:**
- Create: `.github/workflows/release-please.yml`

**Step 1: Create the workflow file**

```yaml
name: Release Please

on:
  push:
    branches:
      - master

permissions:
  contents: write
  pull-requests: write
  models: read

jobs:
  release-please:
    runs-on: ubuntu-latest
    if: github.repository == 'mattogodoy/nametag'
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
      version: ${{ steps.release.outputs.version }}
      pr: ${{ steps.release.outputs.pr }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          token: ${{ secrets.PAT_TOKEN }}

  ai-release-notes:
    runs-on: ubuntu-latest
    needs: release-please
    if: needs.release-please.outputs.pr && !needs.release-please.outputs.release_created
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get PR number
        id: pr-info
        run: |
          PR_JSON='${{ needs.release-please.outputs.pr }}'
          PR_NUMBER=$(echo "$PR_JSON" | jq -r '.number')
          echo "pr_number=${PR_NUMBER}" >> $GITHUB_OUTPUT

      - name: Get commits since last tag
        id: commits
        run: |
          LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
          if [ -z "$LAST_TAG" ]; then
            COMMIT_LOG=$(git log --oneline --no-merges)
          else
            COMMIT_LOG=$(git log ${LAST_TAG}..HEAD --oneline --no-merges)
          fi
          # Filter to meaningful commits only
          FILTERED=$(echo "$COMMIT_LOG" | grep -E "^[a-f0-9]+ (feat|fix|perf)" || echo "No notable changes")
          # Write to file to avoid shell escaping issues
          echo "$FILTERED" > /tmp/commits.txt
          echo "commits_file=/tmp/commits.txt" >> $GITHUB_OUTPUT

      - name: Generate AI release summary
        id: ai-notes
        uses: actions/ai-inference@v1
        with:
          model: openai/gpt-4o-mini
          prompt: |
            You are writing release notes for Nametag, a personal relationships manager web app.

            Here are the commits since the last release:
            ---
            $(cat /tmp/commits.txt)
            ---

            Write a concise release summary for end users. Rules:
            - Group changes by THEME (e.g., "Contact Sync", "UI Polish"), NOT by commit type
            - Write from the user's perspective: what they gain, what's fixed
            - 3-8 bullet points total
            - Start each bullet with a verb (Added, Fixed, Improved, etc.)
            - If there are breaking changes, put them first under a "Breaking Changes" heading
            - Do NOT include commit hashes or technical jargon
            - Do NOT include changes that are invisible to users (refactoring, CI, tests)
            - Use markdown formatting

      - name: Update PR body with AI summary
        env:
          GH_TOKEN: ${{ secrets.PAT_TOKEN }}
        run: |
          PR_NUMBER="${{ steps.pr-info.outputs.pr_number }}"

          # Get current PR body (release-please's changelog)
          CURRENT_BODY=$(gh pr view "$PR_NUMBER" --json body -q '.body')

          # Build new body with AI summary on top
          AI_SUMMARY='${{ steps.ai-notes.outputs.response }}'

          NEW_BODY=$(cat <<PREOF
          ## Release Summary

          ${AI_SUMMARY}

          ---

          <details>
          <summary>Detailed Changelog</summary>

          ${CURRENT_BODY}

          </details>
          PREOF
          )

          # Update the PR
          gh pr edit "$PR_NUMBER" --body "$NEW_BODY"
```

**Notes:**
- `PAT_TOKEN` is reused from the current setup (already a GitHub secret). It's needed for release-please to create PRs and push commits that bypass branch protection.
- The `ai-release-notes` job only runs when a PR exists and no release was just created (i.e., it runs on PR creation/update, not on the merge that creates the release).
- The AI summary is placed above the release-please changelog in a collapsible details section so you see the human summary first.
- `models: read` permission is required for `actions/ai-inference`.
- If the AI step fails, the PR still has release-please's standard changelog.

**Step 2: Commit**

```bash
git add .github/workflows/release-please.yml
git commit -m "feat: add release-please workflow with AI release notes"
```

---

### Task 3: Create the publish workflow

**Files:**
- Create: `.github/workflows/publish.yml`

**Step 1: Create the workflow file**

This extracts the Docker build logic from the current `release.yml` and triggers on release creation instead of push to master.

```yaml
name: Publish Docker Image

on:
  release:
    types: [published]

permissions:
  contents: read
  packages: write

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Set build environment (CI)
        run: |
          echo "DATABASE_URL=postgresql://localhost:5432/dummy" >> "$GITHUB_ENV"
          echo "NEXTAUTH_URL=http://localhost:3000" >> "$GITHUB_ENV"
          echo "RESEND_API_KEY=re_build_time_key" >> "$GITHUB_ENV"
          echo "EMAIL_DOMAIN=build.example.com" >> "$GITHUB_ENV"
          echo "NEXT_TELEMETRY_DISABLED=1" >> "$GITHUB_ENV"
          printf "NEXTAUTH_SECRET=" >> "$GITHUB_ENV"
          head -c 32 < /dev/zero | tr '\0' 'x' >> "$GITHUB_ENV"
          printf "\n" >> "$GITHUB_ENV"
          printf "CRON_SECRET=" >> "$GITHUB_ENV"
          head -c 16 < /dev/zero | tr '\0' 'x' >> "$GITHUB_ENV"
          printf "\n" >> "$GITHUB_ENV"

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run lint
        run: npm run lint

      - name: Run type check
        run: npm run typecheck

      - name: Run tests
        run: npm run test:run

      - name: Build
        run: npm run build

  build-images:
    needs: verify
    runs-on: ubuntu-latest
    strategy:
      matrix:
        arch: [amd64, arm64]
    steps:
      - uses: actions/checkout@v4

      - name: Set up QEMU
        if: matrix.arch == 'arm64'
        uses: docker/setup-qemu-action@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract version from tag
        id: version
        run: |
          # Tag name is like "v0.20.0", strip the "v" prefix
          VERSION="${GITHUB_REF_NAME#v}"
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          platforms: linux/${{ matrix.arch }}
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ matrix.arch }}-${{ steps.version.outputs.version }}
          cache-from: type=gha,scope=${{ matrix.arch }}
          cache-to: type=gha,mode=max,scope=${{ matrix.arch }}
          provenance: false
          sbom: false

  create-manifest:
    needs: [verify, build-images]
    runs-on: ubuntu-latest
    steps:
      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract version from tag
        id: version
        run: |
          VERSION="${GITHUB_REF_NAME#v}"
          SHA_SHORT=$(echo "$GITHUB_SHA" | cut -c1-7)
          TIMESTAMP=$(date -u +'%Y%m%d-%H%M%S')
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "sha_short=${SHA_SHORT}" >> $GITHUB_OUTPUT
          echo "timestamp=${TIMESTAMP}" >> $GITHUB_OUTPUT

      - name: Create and push multi-arch manifest
        run: |
          VERSION="${{ steps.version.outputs.version }}"
          SHA="${{ steps.version.outputs.sha_short }}"
          TIMESTAMP="${{ steps.version.outputs.timestamp }}"
          IMAGE="ghcr.io/${{ github.repository }}"

          # Create manifest for version tag
          docker buildx imagetools create -t ${IMAGE}:${VERSION} \
            ${IMAGE}:amd64-${VERSION} \
            ${IMAGE}:arm64-${VERSION}

          # Create manifest for latest tag
          docker buildx imagetools create -t ${IMAGE}:latest \
            ${IMAGE}:amd64-${VERSION} \
            ${IMAGE}:arm64-${VERSION}

          # Create manifest for SHA tag
          docker buildx imagetools create -t ${IMAGE}:${SHA} \
            ${IMAGE}:amd64-${VERSION} \
            ${IMAGE}:arm64-${VERSION}

          # Create manifest for timestamp tag
          docker buildx imagetools create -t ${IMAGE}:${TIMESTAMP} \
            ${IMAGE}:amd64-${VERSION} \
            ${IMAGE}:arm64-${VERSION}
```

**Notes:**
- Triggers on `release: types: [published]` which fires when release-please merges the Release PR and creates the GitHub Release.
- The verify job runs lint, typecheck, tests, and build as a gate before Docker images are built.
- Version is extracted from `GITHUB_REF_NAME` (the tag name, e.g., `v0.20.0`) instead of being passed between jobs.
- Docker build logic is identical to the current `release.yml`.
- `contents: read` is sufficient since this workflow doesn't create commits or tags.

**Step 2: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "feat: add publish workflow triggered by release events"
```

---

### Task 4: Remove old release tooling

**Files:**
- Delete: `.release-it.json`
- Delete: `scripts/generate-release-notes.sh`
- Delete: `.github/workflows/release.yml`
- Modify: `package.json` (remove scripts and dependencies)

**Step 1: Delete config and script files**

```bash
rm .release-it.json
rm scripts/generate-release-notes.sh
rm .github/workflows/release.yml
```

**Step 2: Remove release-related npm scripts from package.json**

Remove these scripts from the `"scripts"` section of `package.json`:
```
"release": "release-it",
"release:dry": "release-it --dry-run",
"release:patch": "release-it patch",
"release:minor": "release-it minor",
"release:major": "release-it major",
"changelog": "auto-changelog -p"
```

**Step 3: Remove old dependencies**

```bash
npm uninstall release-it @release-it/conventional-changelog auto-changelog
```

**Notes:**
- This removes `release-it`, `@release-it/conventional-changelog`, and `auto-changelog` from `devDependencies`.
- The `npm uninstall` command also updates `package-lock.json`.
- After this step, `package.json` should have no references to `release-it`, `auto-changelog`, or the removed scripts.

**Step 4: Verify the project still builds**

```bash
npm run verify
```

Expected: All lint, typecheck, tests, and build pass. None of these depend on the removed packages.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove release-it, auto-changelog, and old release workflow"
```

---

### Task 5: Update documentation

**Files:**
- Modify: `docs/VERSIONING.md`
- Modify: `CLAUDE.md`

**Step 1: Rewrite docs/VERSIONING.md**

Replace the full contents of `docs/VERSIONING.md` with the following. This reflects the new release-please workflow while preserving the useful reference material (conventional commits, version format, etc.):

```markdown
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
```

**Step 2: Update CLAUDE.md**

In `CLAUDE.md`, find the "Development Commands" section. Replace the release-related content. Specifically, remove any references to `release-it`, `auto-changelog`, and the old npm scripts (`release`, `release:dry`, `release:patch`, etc.).

The CLAUDE.md does not currently have a dedicated release section, but the `package.json` scripts section references them. Since the scripts are being removed from package.json, CLAUDE.md needs no explicit changes beyond ensuring no stale references exist.

However, check `CLAUDE.md` for any mention of `release-it`, `auto-changelog`, or the removed scripts and remove them if found.

**Step 3: Commit**

```bash
git add docs/VERSIONING.md CLAUDE.md
git commit -m "docs: update versioning guide for release-please workflow"
```

---

### Task 6: Verify end-to-end locally

**Files:** None (verification only)

**Step 1: Confirm no stale references**

Search the codebase for any remaining references to the removed tools:

```bash
grep -r "release-it" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.sh" .
grep -r "auto-changelog" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.sh" .
grep -r "generate-release-notes" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.md" --include="*.sh" .
```

Expected: No results (or only references in the design doc / plan files, which is fine).

**Step 2: Verify package.json is clean**

```bash
node -e "const p = require('./package.json'); console.log('Scripts:', Object.keys(p.scripts)); console.log('DevDeps:', Object.keys(p.devDependencies))"
```

Expected: No `release`, `release:dry`, `release:patch`, `release:minor`, `release:major`, or `changelog` in scripts. No `release-it`, `@release-it/conventional-changelog`, or `auto-changelog` in devDependencies.

**Step 3: Verify build still works**

```bash
npm run verify
```

Expected: lint, typecheck, tests, and build all pass.

**Step 4: Verify workflow files are valid YAML**

```bash
npx yaml-lint .github/workflows/release-please.yml .github/workflows/publish.yml
```

Or if yaml-lint is not available:

```bash
node -e "const yaml = require('next/dist/compiled/yaml'); const fs = require('fs'); ['release-please.yml', 'publish.yml'].forEach(f => { try { yaml.parse(fs.readFileSync('.github/workflows/' + f, 'utf8')); console.log(f + ': valid'); } catch(e) { console.error(f + ': INVALID', e.message); } })"
```

Expected: Both files parse as valid YAML.

**Step 5: Commit if any fixes were needed**

If any stale references or issues were found and fixed:

```bash
git add -A
git commit -m "fix: clean up stale references to old release tooling"
```

---

### Task 7: Final review and push

**Files:** None

**Step 1: Review the full diff**

```bash
git log --oneline master..HEAD
git diff master..HEAD --stat
```

Review that:
- `release-please-config.json` and `.release-please-manifest.json` exist
- `.github/workflows/release-please.yml` and `.github/workflows/publish.yml` exist
- `.github/workflows/release.yml` is deleted
- `.release-it.json` is deleted
- `scripts/generate-release-notes.sh` is deleted
- `package.json` has no release-it/auto-changelog references
- `docs/VERSIONING.md` reflects the new process

**Step 2: Push and observe**

Push to master. release-please should create the first Release PR on the next push that includes releasable commits (feat/fix/perf). Until then, it will just track the state.

**Notes:**
- The first run of release-please may need to "bootstrap" — it reads the manifest to know the current version and looks for conventional commits since the last tag (`v0.19.0`).
- If the push itself only contains `chore:` and `docs:` commits (like these changes), no Release PR will be created until a `feat:` or `fix:` commit lands on master.
- The `PAT_TOKEN` secret is already configured in the repo from the old workflow.

---

## Post-Implementation Notes

**Testing the AI release notes:** The `ai-release-notes` job will only run when there's an active Release PR. To test it, push a `feat:` or `fix:` commit to master after the new workflows are in place.

**If GitHub Models is unavailable:** The `actions/ai-inference` step may need to be confirmed for your GitHub plan. If it's not available, the fallback is to remove the `ai-release-notes` job entirely — release-please's standard changelog is still a major improvement over auto-changelog.

**Cleanup opportunity:** The `fix/releases-token` branch can be deleted since the old workflow it was patching no longer exists:
```bash
git push origin --delete fix/releases-token
```
