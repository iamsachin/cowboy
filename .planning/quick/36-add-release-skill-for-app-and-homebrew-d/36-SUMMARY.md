---
phase: quick-36
plan: 01
subsystem: tooling
tags: [release, homebrew, dmg, tauri, automation]
dependency_graph:
  requires: []
  provides: [release-script, release-skill]
  affects: [scripts, .claude/skills]
tech_stack:
  added: [homebrew-cask-formula]
  patterns: [local-release-pipeline, skill-driven-workflow]
key_files:
  created:
    - scripts/release.sh
    - .claude/skills/release/SKILL.md
  modified: []
decisions:
  - Used Homebrew Cask (not Formula) since Cowboy is a macOS .app distributed as DMG
  - Placed cask in Casks/cowboy.rb following Homebrew cask conventions
metrics:
  duration: 176s
  completed: "2026-03-30T11:16:44Z"
---

# Quick Task 36: Add Release Skill for App and Homebrew Distribution

Local release pipeline with build script and Claude-facing skill for one-command Cowboy releases.

## What Was Built

### scripts/release.sh
Automated release script that accepts a semver version and handles the full release flow:
- Validates arguments and checks prerequisites (pnpm, gh, cargo, jq, gh auth)
- Builds the Tauri app via `pnpm build`, producing a DMG
- Auto-detects CPU architecture (aarch64/x64) for correct DMG filename
- Creates a GitHub Release with the DMG attached
- Clones/creates the `iamsachin/homebrew-cowboy` tap repo and updates the Cask formula
- Computes SHA256 of the DMG for Homebrew verification
- Supports `--build-only` flag to skip publishing and `--help` for usage
- Prints cleanup commands if a release fails partway through

### .claude/skills/release/SKILL.md
Step-by-step release instructions for Claude covering:
1. Version selection (show current, offer bump)
2. Version bump in both `Cargo.toml` and `tauri.conf.json`
3. CHANGELOG.md update
4. Commit, tag, and push
5. Run `scripts/release.sh` for build + publish
6. Post-release verification
7. Build-only mode documentation
8. Failure cleanup rules

## Task Summary

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create release.sh script | dacdef7 | scripts/release.sh |
| 2 | Create release SKILL.md | 01c9d2d | .claude/skills/release/SKILL.md |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `scripts/release.sh --help` prints usage without errors
- `scripts/release.sh` is executable
- `.claude/skills/release/SKILL.md` exists with correct frontmatter
- SKILL.md references both version files (Cargo.toml and tauri.conf.json)
- SKILL.md references scripts/release.sh

## Self-Check: PASSED
