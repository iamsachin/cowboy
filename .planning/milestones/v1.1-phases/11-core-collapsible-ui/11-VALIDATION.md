---
phase: 11
slug: core-collapsible-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `packages/frontend/vitest.config.ts` |
| **Quick run command** | `cd packages/frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/frontend && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | GROUP-03, UX-01 | unit | `cd packages/frontend && npx vitest run tests/composables/useCollapseState.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 0 | GROUP-03, GROUP-06 | unit | `cd packages/frontend && npx vitest run tests/utils/turn-helpers.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | GROUP-03 | unit | `cd packages/frontend && npx vitest run tests/composables/useCollapseState.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | GROUP-04, GROUP-05 | manual | Visual verification in browser | N/A | ⬜ pending |
| 11-03-01 | 03 | 1 | GROUP-06 | unit | `cd packages/frontend && npx vitest run tests/utils/turn-helpers.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | UX-01 | unit | `cd packages/frontend && npx vitest run tests/composables/useCollapseState.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/frontend/tests/composables/useCollapseState.test.ts` — stubs for UX-01, GROUP-03 (state management, expandAll, collapseAll, toggle)
- [ ] `packages/frontend/tests/utils/turn-helpers.test.ts` — stubs for GROUP-03 (preview snippet, duration calc), GROUP-06 (truncation logic)

*Existing infrastructure covers framework setup (vitest.config.ts, happy-dom).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Thinking section collapsible inside expanded turn | GROUP-04 | Visual/DOM interaction within details/summary | 1. Expand a turn with thinking content. 2. Verify thinking section has details/summary toggle. 3. Toggle thinking open/closed. |
| Tool call rows visible when turn expanded | GROUP-05 | Visual layout verification | 1. Expand a turn with tool calls. 2. Verify tool call rows render with name, status, duration. |
| Sticky toolbar stays pinned on scroll | UX-01 | Scroll behavior verification | 1. Load conversation with 10+ turns. 2. Scroll down. 3. Verify toolbar stays pinned at top. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
