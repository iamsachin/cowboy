---
phase: quick-52
plan: 01
subsystem: infra
tags: [codesign, notarization, macos, tauri, release]

requires:
  - phase: quick-36
    provides: release skill and release.sh script
provides:
  - macOS code signing with hardened runtime in release script
  - DMG notarization and stapling in release script
  - Release skill documentation for signing env vars and security rules
affects: [release]

tech-stack:
  added: [codesign, xcrun notarytool, xcrun stapler]
  patterns: [env var validation before build, post-build signing pipeline]

key-files:
  created: []
  modified:
    - scripts/release.sh
    - .claude/skills/release/SKILL.md

key-decisions:
  - "Keep single tauri build command (app,dmg), sign .app after build, notarize DMG as-is"
  - "Use keychain profile for notarytool credentials instead of inline secrets"

patterns-established:
  - "Signing pipeline: build -> sign .app -> notarize DMG -> staple"
  - "All Apple credentials via environment variables, never hardcoded"

requirements-completed: [QUICK-52]

duration: 2min
completed: 2026-04-03
---

# Quick Task 52: Add Signing and Notarization to Release Summary

**macOS code signing with hardened runtime and DMG notarization/stapling added to release.sh, with env var docs and security rules in SKILL.md**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T10:59:11Z
- **Completed:** 2026-04-03T11:01:13Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- release.sh validates APPLE_SIGN_IDENTITY and COWBOY_NOTARIZE_PROFILE before building
- release.sh signs .app with hardened runtime after tauri build, notarizes DMG, and staples ticket
- SKILL.md documents all three required env vars with setup instructions and prominent security warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Add signing and notarization to release.sh** - `0a09c51` (feat)
2. **Task 2: Update release SKILL.md with signing docs and security rules** - `b713290` (docs)

## Files Created/Modified
- `scripts/release.sh` - Added env var validation, codesign with hardened runtime, notarytool submit, stapler staple
- `.claude/skills/release/SKILL.md` - Added Required Environment Variables section, Security section, updated step 7

## Decisions Made
- Kept single `npx tauri build --bundles app,dmg` command and sign .app after build rather than splitting into two build steps
- Used keychain profile approach for notarytool credentials (secure, no inline passwords)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- Release script ready for next release with signing and notarization
- User must set up env vars (APPLE_SIGN_IDENTITY, APPLE_DEVELOPER_TEAM_ID, COWBOY_NOTARIZE_PROFILE) before running

---
*Quick Task: 52*
*Completed: 2026-04-03*
