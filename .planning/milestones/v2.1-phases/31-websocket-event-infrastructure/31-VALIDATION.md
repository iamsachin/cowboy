---
phase: 31
slug: websocket-event-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace config) |
| **Config file** | `packages/backend/vitest.config.ts`, `packages/frontend/vitest.config.ts` |
| **Quick run command** | `cd packages/backend && npx vitest run tests/websocket.test.ts && cd ../frontend && npx vitest run tests/composables/useWebSocket.test.ts` |
| **Full suite command** | `cd packages/backend && npx vitest run && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/backend && npx vitest run tests/websocket.test.ts && cd ../frontend && npx vitest run tests/composables/useWebSocket.test.ts`
- **After every plan wave:** Run `cd packages/backend && npx vitest run && cd ../frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | PUSH-02f | unit | `cd packages/shared && npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 31-02-01 | 02 | 1 | PUSH-02a | integration | `cd packages/backend && npx vitest run tests/websocket.test.ts -x` | ✅ (needs update) | ⬜ pending |
| 31-02-02 | 02 | 1 | PUSH-02b | integration | `cd packages/backend && npx vitest run tests/websocket.test.ts -x` | ✅ (needs update) | ⬜ pending |
| 31-02-03 | 02 | 1 | PUSH-02c | integration | `cd packages/backend && npx vitest run tests/settings/settings-api.test.ts -x` | ✅ (needs update) | ⬜ pending |
| 31-02-04 | 02 | 1 | PUSH-02g | integration | `cd packages/backend && npx vitest run tests/websocket.test.ts -x` | ✅ (needs update) | ⬜ pending |
| 31-03-01 | 03 | 2 | PUSH-02d | unit | `cd packages/frontend && npx vitest run tests/composables/useWebSocket.test.ts -x` | ✅ (needs update) | ⬜ pending |
| 31-03-02 | 03 | 2 | PUSH-02e | unit | `cd packages/frontend && npx vitest run tests/composables/useWebSocket.test.ts -x` | ✅ (needs update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/types/websocket-events.ts` — shared type definitions (new file)
- [ ] Update `packages/backend/tests/websocket.test.ts` — assert typed events instead of `data-changed`
- [ ] Update `packages/frontend/tests/composables/useWebSocket.test.ts` — test `on(type, cb)` API, gap detection, reconnect seq reset

*Wave 0 creates test stubs and shared types before implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab visibility triggers full-refresh | PUSH-02 | Browser visibility API not available in vitest | 1. Open app in browser 2. Switch tabs for 30s 3. Return to tab 4. Verify data refreshes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
