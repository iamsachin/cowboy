---
phase: 40
slug: file-watcher-desktop-chrome
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | cargo test (Rust) + vitest (frontend, existing) |
| **Config file** | src-tauri/Cargo.toml |
| **Quick run command** | `cd src-tauri && cargo test --lib` |
| **Full suite command** | `cd src-tauri && cargo test && pnpm --filter @cowboy/frontend build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd src-tauri && cargo test --lib`
- **After every plan wave:** Run `cd src-tauri && cargo test && pnpm --filter @cowboy/frontend build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | WATCH-01 | unit | `cd src-tauri && cargo test watcher` | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | WATCH-02 | unit | `cd src-tauri && cargo test watcher::debounce` | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 1 | DESK-01 | manual | Manual: run app, check tray icon + menu | N/A | ⬜ pending |
| 40-02-02 | 02 | 1 | DESK-02 | manual | Manual: close window, verify hide-to-tray | N/A | ⬜ pending |
| 40-02-03 | 02 | 1 | DESK-03 | manual | Manual: check menu bar items and shortcuts | N/A | ⬜ pending |
| 40-03-01 | 03 | 2 | - | build | `pnpm --filter @cowboy/frontend build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src-tauri/src/watcher.rs` — stubs with unit tests for path filtering and debounce logic
- [ ] Verify `cargo build` succeeds with notify + tray-icon features before implementation
- [ ] Verify `pnpm --filter @cowboy/frontend build` succeeds after shared types migration

*Wave 0 creates test stubs for WATCH-01 and WATCH-02 before implementation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System tray icon visible with Show/Quit | DESK-01 | Requires GUI inspection | 1. Run `cargo tauri dev` 2. Check macOS tray for cowboy hat icon 3. Right-click: verify Show + Quit items |
| Close-to-tray hides window | DESK-02 | Requires GUI interaction | 1. Close window via red X 2. Verify window hidden 3. Click tray Show → window restored 4. Verify watchers still running (check logs) |
| Native menu bar correct | DESK-03 | Requires GUI inspection | 1. Check Cowboy menu: About + Quit 2. Check Edit menu: Undo, Redo, Cut, Copy, Paste, Select All 3. Test Cmd+C, Cmd+V, Cmd+Q shortcuts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
