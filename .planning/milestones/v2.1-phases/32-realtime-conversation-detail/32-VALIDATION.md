---
phase: 32
slug: realtime-conversation-detail
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `packages/frontend/vitest.config.ts` |
| **Quick run command** | `cd packages/frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/frontend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | PUSH-01 | unit | `cd packages/frontend && npx vitest run tests/composables/useConversationDetail.test.ts -x` | ❌ W0 | ⬜ pending |
| 32-01-02 | 01 | 1 | PUSH-03 | unit | `cd packages/frontend && npx vitest run tests/composables/useScrollTracker.test.ts -x` | ❌ W0 | ⬜ pending |
| 32-01-03 | 01 | 1 | PUSH-03 | unit | `cd packages/frontend && npx vitest run tests/composables/useScrollTracker.test.ts -x` | ❌ W0 | ⬜ pending |
| 32-01-04 | 01 | 1 | PUSH-03 | unit | `cd packages/frontend && npx vitest run tests/composables/useScrollTracker.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/composables/useConversationDetail.test.ts` — stubs for PUSH-01 (debounce, in-flight queue, refetch on WS events)
- [ ] `tests/composables/useScrollTracker.test.ts` — stubs for PUSH-03 (at-bottom detection, scroll preservation, auto-scroll)

*Note: happy-dom has limited scroll API; tests may need to mock scrollHeight/scrollTop/clientHeight.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Floating pill visual appearance | PUSH-03 | CSS styling, DaisyUI theme integration | 1. Open conversation with active agent 2. Scroll up from bottom 3. Wait for new messages 4. Verify pill appears with correct count 5. Click pill, verify smooth scroll to bottom |
| Fade-in animation on new groups | PUSH-01 | Visual animation timing | 1. Open conversation with active agent 2. Stay at bottom 3. Observe new message groups fade in (~200ms) 4. Verify existing groups do NOT re-animate |
| Green dot live indicator | PUSH-01 | Visual indicator in metadata header | 1. Open active conversation 2. Verify green pulsing dot next to status 3. Wait for conversation to complete 4. Verify dot disappears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
