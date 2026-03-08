---
phase: 10
slug: data-grouping-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/frontend/vitest.config.ts` |
| **Quick run command** | `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts` |
| **Full suite command** | `cd packages/frontend && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts`
- **After every plan wave:** Run `cd packages/frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | GROUP-01 | unit | `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | GROUP-01 | unit | `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | GROUP-01 | unit | `cd packages/frontend && npx vitest run tests/composables/useGroupedTurns.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | GROUP-02 | manual-only | Visual inspection: open conversation detail, verify text visible | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/frontend/tests/composables/useGroupedTurns.test.ts` — stubs for GROUP-01 (grouping, orphan handling, consecutive separation)
- [ ] Extract `groupTurns` as a pure function so it's testable without Vue reactivity

*Existing vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Assistant text visible without expanding | GROUP-02 | Rendering/layout verification requires visual inspection | Open conversation detail view, verify assistant output text is visible on each turn without clicking or expanding |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
