---
phase: 34
slug: live-token-usage-widget
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.0.0 |
| **Config file** | Per-package package.json scripts |
| **Quick run command** | `cd packages/backend && npx vitest run tests/analytics/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` (root) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/backend && npx vitest run tests/analytics/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run` (root)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 34-01-01 | 01 | 1 | WIDG-04 | unit | `cd packages/backend && npx vitest run tests/analytics/token-rate.test.ts -x` | ❌ W0 | ⬜ pending |
| 34-01-02 | 01 | 1 | WIDG-04 | unit | `cd packages/backend && npx vitest run tests/analytics/token-rate.test.ts -x` | ❌ W0 | ⬜ pending |
| 34-02-01 | 02 | 2 | WIDG-01 | manual | Visual verification | N/A | ⬜ pending |
| 34-02-02 | 02 | 2 | WIDG-02 | manual | Visual verification | N/A | ⬜ pending |
| 34-02-03 | 02 | 2 | WIDG-03 | manual | Visual verification + localStorage check | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/backend/tests/analytics/token-rate.test.ts` — stubs for WIDG-04 (per-minute aggregation, empty window, rolling window boundary)
- [ ] Shared type export for `TokenRatePoint` in shared index

*Existing infrastructure covers frontend manual verifications.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pill displays formatted token rates with up/down arrows | WIDG-01 | Visual styling, animation, hover states | 1. Navigate to any page 2. Verify pill visible bottom-right 3. Verify format "↑ Xk/min ↓ Yk/min" 4. Hover to see dismiss X |
| Chart popover shows 60-min line chart | WIDG-02 | Chart.js canvas rendering, interactive tooltips | 1. Click pill 2. Verify popover appears above pill 3. Verify two line series (input/output) 4. Click outside to dismiss |
| Dismiss persists, sidebar restore works | WIDG-03 | Cross-component localStorage integration | 1. Hover pill, click X 2. Verify pill disappears 3. Refresh page, verify still hidden 4. Click "Show live usage" in sidebar 5. Verify pill reappears |
| Idle state dims pill | WIDG-01 | Visual opacity change | 1. Wait for zero-token period 2. Verify pill is dimmed/ghost opacity |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
