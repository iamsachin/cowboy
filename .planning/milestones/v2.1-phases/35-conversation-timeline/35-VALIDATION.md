---
phase: 35
slug: conversation-timeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | `vitest.config.ts` (workspace root) + `packages/frontend/vitest.config.ts` |
| **Quick run command** | `npx vitest run --project frontend` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --project frontend`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | TIME-01 | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "extractTimelineEvents"` | ❌ W0 | ⬜ pending |
| 35-01-02 | 01 | 1 | TIME-03 | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "localStorage"` | ❌ W0 | ⬜ pending |
| 35-01-03 | 01 | 1 | TIME-03 | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "default open"` | ❌ W0 | ⬜ pending |
| 35-01-04 | 01 | 1 | TIME-01 | unit | `npx vitest run --project frontend tests/components/ConversationTimeline.test.ts` | ❌ W0 | ⬜ pending |
| 35-02-01 | 02 | 2 | TIME-02 | unit | `npx vitest run --project frontend tests/composables/useTimeline.test.ts -t "scrollToTurn"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/frontend/tests/composables/useTimeline.test.ts` — stubs for TIME-01, TIME-02, TIME-03 (composable logic)
- [ ] `packages/frontend/tests/components/ConversationTimeline.test.ts` — stubs for TIME-01 (component rendering)

*Existing infrastructure covers framework and config — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smooth scroll animation on click | TIME-02 | Visual animation quality | Click timeline event → verify smooth scroll to target turn |
| Timeline auto-scrolls to keep highlighted event visible | TIME-02 | Bidirectional scroll sync UX | Scroll conversation → verify timeline follows |
| New events appear with highlight animation | TIME-01 | CSS animation visual | Send message in active conversation → verify green highlight fade |
| Panel collapse/expand layout transition | TIME-03 | CSS layout transition | Click toggle → verify smooth layout shift |
| Live pulse-dot on latest event | TIME-01 | Visual indicator | View active conversation → verify blinking green dot |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
