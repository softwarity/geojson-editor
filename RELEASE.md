# Release Guide

This document explains how to publish a new version of `@softwarity/geojson-editor` to npm using GitHub Actions.

## Prerequisites

### 1. NPM Token

Create an npm access token and add it to GitHub Secrets:

1. Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. Click "Generate New Token" → "Classic Token"
3. Select "Automation" type
4. Copy the token
5. Add it to GitHub repository secrets:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: paste your npm token

### 2. Personal Access Token (PAT)

Create a GitHub Personal Access Token for the release workflow:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "geojson-editor-release")
4. Set expiration as needed
5. Select scopes:
   - `repo` (full control of private repositories)
   - `workflow` (update GitHub Actions workflows)
6. Copy the token
7. Add it to GitHub repository secrets:
   - Name: `PAT_TOKEN`
   - Value: paste your GitHub PAT

## GitHub Actions Workflows

This project uses 3 automated workflows:

### 1. **main.yml** - Continuous Build

- **Trigger**: Every push to any branch
- **Purpose**: Validates that the code builds successfully
- **Actions**:
  - Checkout code
  - Install dependencies
  - Build package
  - Verify build output

### 2. **release.yml** - Create Tag/Release

- **Trigger**: Manual (workflow_dispatch)
- **Purpose**: Bump version and create git tag
- **Actions**:
  - Increment patch version (`npm version patch`)
  - Commit the version change
  - Push changes and tags
  - Triggers `tag.yml` automatically

### 3. **tag.yml** - Publish to npm

- **Trigger**: When a git tag is pushed
- **Purpose**: Publish package to npm registry
- **Actions**:
  - Build the package
  - Publish to npm

## Release Process

### Automatic Release (Recommended)

The easiest way to release is using the GitHub Actions UI:

1. Go to your repository on GitHub
2. Click on "Actions" tab
3. Select "Create Tag/Release" workflow from the left sidebar
4. Click "Run workflow" button
5. Select the branch (usually `main`)
6. Click "Run workflow"

This will:
- Automatically bump the patch version (e.g., 1.0.0 → 1.0.1)
- Create a git tag
- Trigger the publish workflow
- Publish to npm

### Manual Release (Advanced)

If you need to bump a specific version type or want manual control:

```bash
# 1. Checkout main branch
git checkout main
git pull origin main

# 2. Bump version (choose one)
npm version patch  # 1.0.0 → 1.0.1 (bug fixes)
npm version minor  # 1.0.0 → 1.1.0 (new features)
npm version major  # 1.0.0 → 2.0.0 (breaking changes)

# 3. Push changes and tags
git push --all
git push --tags
```

The `tag.yml` workflow will automatically detect the new tag and publish to npm.

## Version Numbering (SemVer)

Follow Semantic Versioning (https://semver.org/):

- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backwards compatible
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible
- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, not backwards compatible

Examples:

| Change Type | Example | Version Bump |
|-------------|---------|--------------|
| Fix a bug | Fixed color picker positioning | `patch` |
| Add feature | Add line numbering | `minor` |
| Breaking API | Rename attribute `collapsable` to `collapsible` | `major` |

## Monitoring Releases

### GitHub Actions

Monitor the release process:

1. Go to "Actions" tab in your repository
2. Watch the workflows:
   - "Create Tag/Release" - should complete in ~30s
   - "Publish softwarity/geojson-editor to NPM" - should start automatically after tag creation

### NPM Registry

Verify publication:

```bash
# Check latest version
npm view @softwarity/geojson-editor version

# Check all versions
npm view @softwarity/geojson-editor versions

# Install and test
npm install @softwarity/geojson-editor@latest
```

Or visit: https://www.npmjs.com/package/@softwarity/geojson-editor

## Troubleshooting

### Release workflow fails with "401 Unauthorized"

**Problem**: Cannot push to repository

**Solution**:
- Verify `PAT_TOKEN` is set correctly in GitHub Secrets
- Ensure the PAT has `repo` and `workflow` scopes
- Check the PAT hasn't expired

### Tag workflow fails with "401 Unauthorized" (npm)

**Problem**: Cannot publish to npm

**Solution**:
- Verify `NPM_TOKEN` is set correctly in GitHub Secrets
- Check the token is still valid at npmjs.com
- Ensure the token has "Automation" or "Publish" permissions
- Verify you have publish rights to the `@softwarity` scope

### Version already exists on npm

**Problem**: `npm publish` fails because version already exists

**Solution**:
- You cannot re-publish the same version
- Bump to a new version:
  ```bash
  npm version patch
  git push --all && git push --tags
  ```

### Tag already exists

**Problem**: Git tag already exists locally or remotely

**Solution**:

```bash
# Delete local tag
git tag -d v1.2.3

# Delete remote tag
git push origin :refs/tags/v1.2.3

# Recreate if needed
git tag v1.2.3
git push origin v1.2.3
```

### Build fails

**Problem**: Build step fails in workflow

**Solution**:
- Test build locally first: `npm run build`
- Check all dependencies are in `package.json`
- Verify `vite.config.js` is correct
- Review build logs in GitHub Actions

## First Release Checklist

Before publishing v1.0.0 for the first time:

- [ ] Update `package.json` with correct name, version, author, license
- [ ] Verify package name is available on npm: `npm search @softwarity/geojson-editor`
- [ ] Write comprehensive README.md
- [ ] Add LICENSE file (MIT)
- [ ] Test the component locally in `demo/index.html`
- [ ] Verify `npm run build` produces valid output in `dist/`
- [ ] Set up `NPM_TOKEN` in GitHub Secrets
- [ ] Set up `PAT_TOKEN` in GitHub Secrets
- [ ] Run "Create Tag/Release" workflow
- [ ] Monitor GitHub Actions for success
- [ ] Verify package appears on npmjs.com
- [ ] Test installation: `npm install @softwarity/geojson-editor`

## Quick Reference

```bash
# Local development
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Release via GitHub UI
# → Go to Actions → Create Tag/Release → Run workflow

# Manual release
npm version patch    # Bump version
git push --all       # Push changes
git push --tags      # Push tags (triggers publish)

# Check npm
npm view @softwarity/geojson-editor version
```
