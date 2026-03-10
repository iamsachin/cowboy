---
phase: 33
slug: realtime-conversation-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (workspace config) |
| **Config file** | `packages/frontend/vitest.config.ts` |
| **Quick run command** | `cd packages/frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/frontend && npx vitest run && cd ../backend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/frontend && npx vitest run && cd ../backend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | PUSH-04 | unit | `cd packages/frontend && npx vitest run tests/composables/useConversationBrowser.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-01-02 | 01 | 1 | PUSH-04 | unit | `cd packages/frontend && npx vitest run tests/composables/useConversationBrowser.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-01-03 | 01 | 1 | PUSH-05 | unit | `cd packages/frontend && npx vitest run tests/composables/useConversations.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-01-04 | 01 | 1 | PUSH-05 | unit | `cd packages/frontend && npx vitest run tests/composables/useConversations.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-01-05 | 01 | 1 | PUSH-05 | unit | `cd packages/frontend && npx vitest run tests/composables/useConversations.test.ts -x` | ❌ W0 | ⬜ pending |
| 33-02-01 | 02 | 1 | PUSH-04 | manual | Browser verify | N/A | ⬜ pending |
| 33-02-02 | 02 | 1 | PUSH-05 | manual | Browser verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/composables/useConversationBrowser.test.ts` — stubs for PUSH-04 (debounced WS refetch, pagination preservation)
- [ ] `tests/composables/useConversations.test.ts` — stubs for PUSH-05 (WS subscription, debounce, page preservation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| New conversation row appears in Conversations page | PUSH-04 | Requires live agent creating conversation | Start an agent, observe list page updates without refresh |
| New conversation row appears in Overview table | PUSH-05 | Requires live agent creating conversation | Start an agent, observe overview table updates without refresh |
| Row highlight animation on new rows | PUSH-04, PUSH-05 | Visual effect | Verify brief green fade on newly appeared rows |
| Pagination preserved during live update | PUSH-04 | Requires being on page > 1 | Navigate to page 2+, trigger new conversation, verify page stays |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
