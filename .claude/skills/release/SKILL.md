---
name: release
description: Build and release Cowboy entirely from the local machine (no CI costs)
---

# Release

Build Cowboy locally, create GitHub Release with DMG, and update Homebrew tap.

## Steps

1. Ask the user which version to release. Show current version from `src-tauri/tauri.conf.json` and offer to bump patch/minor/major.
2. Update `version` in `src-tauri/Cargo.toml` (`[package]` section, `version = "X.Y.Z"`) to the chosen version.
3. Update `version` in `src-tauri/tauri.conf.json` (top-level `"version"` field) to the same version. Both files MUST match.
4. Update `CHANGELOG.md` -- add a new section for the version if it doesn't exist, or confirm the existing entry is up to date. Create the file if it doesn't exist.
5. Commit version bump files (`src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and any other changed files) to main.
6. Create git tag `v<version>` and push both main and the tag to remote.
7. Run the local release script:
   ```bash
   ./scripts/release.sh <version>
   ```
   This does everything: builds the Tauri app, creates DMG, creates GitHub Release with DMG attached, and updates the Homebrew tap (`iamsachin/homebrew-cowboy`).

## After the script completes

1. Verify GitHub Release: `gh release view v<version>`
2. Verify Homebrew tap: `gh repo view iamsachin/homebrew-cowboy --web` (check Formula/cowboy.rb)
3. Report a summary table with GitHub Release URL and Homebrew status.

## Build-only mode (no publish)

```bash
./scripts/release.sh --build-only <version>
```

Builds DMG locally without creating a release or updating Homebrew.

## Rules

- Version in `Cargo.toml` and `tauri.conf.json` MUST always match.
- Do NOT use the Agent or TodoWrite tools.
- If the release fails partway, check what was published and either fix forward or clean up:
  - Delete failed release: `gh release delete v<version> --yes`
  - Delete tag: `git tag -d v<version> && git push origin :refs/tags/v<version>`
- The build command is `pnpm build` (which runs `cargo tauri build`). Do NOT run cargo directly.
- DMG output is in `src-tauri/target/release/bundle/dmg/`.
