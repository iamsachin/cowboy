---
phase: 13
slug: visual-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | packages/frontend/vitest.config.ts |
| **Quick run command** | `cd packages/frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/frontend && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 0 | META-03 | unit | `cd packages/frontend && npx vitest run tests/utils/tool-icons.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 0 | META-04 | unit | `cd packages/frontend && npx vitest run tests/utils/model-labels.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | META-03 | unit | `cd packages/frontend && npx vitest run tests/utils/tool-icons.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | META-04 | unit | `cd packages/frontend && npx vitest run tests/utils/model-labels.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-05 | 01 | 2 | META-03 | unit | `cd packages/frontend && npx vitest run tests/utils/tool-icons.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/frontend/tests/utils/tool-icons.test.ts` — stubs for META-03 (tool icon lookup, fallback)
- [ ] `packages/frontend/tests/utils/model-labels.test.ts` — stubs for META-04 (model label/badge lookup, null handling)

*Wave 0 creates test stubs that initially fail, then pass as implementation progresses.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Icons render visually in ToolCallRow | META-03 | Visual rendering in browser | Open conversation detail, verify each tool type shows correct icon |
| Model badges show distinct colors | META-04 | Color differentiation is visual | Open summary view, verify different models have different badge colors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
