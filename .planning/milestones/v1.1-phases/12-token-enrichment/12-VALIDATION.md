---
phase: 12
slug: token-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/frontend/vitest.config.ts, packages/backend/vitest.config.ts |
| **Quick run command** | `pnpm --filter backend test -- --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter backend test -- --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | META-01 | integration | `pnpm --filter backend test -- --run` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | META-02 | integration | `pnpm --filter backend test -- --run` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | META-01 | visual | Manual verification | N/A | ⬜ pending |
| 12-02-02 | 02 | 2 | META-02 | visual | Manual verification | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend integration test for per-message token query
- [ ] Update seed-analytics.ts to include messageId on tokenUsage records

*Existing frontend test infrastructure covers component-level needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Token counts display in summary header | META-01 | Visual rendering in AssistantGroupCard | Open conversation, expand group, verify token counts visible |
| Cost display in summary header | META-02 | Visual rendering in AssistantGroupCard | Open conversation, verify cost shown next to token counts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
