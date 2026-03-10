# Requirements: Cowboy

**Defined:** 2026-03-10
**Core Value:** Give developers a single, unified view of how their coding agents are performing

## v2.1 Requirements

Requirements for v2.1 Realtime & Live Insights. Each maps to roadmap phases.

### Realtime Push

- [x] **PUSH-01**: User sees new messages appear on an open conversation page without manual refresh (JSON-based CLI agents only)
- [x] **PUSH-02**: Backend broadcasts conversation IDs in WebSocket payload so detail page only refetches when its conversation is updated
- [x] **PUSH-03**: Scroll position is preserved when new messages arrive — auto-scroll if at bottom, hold position if scrolled up
- [x] **PUSH-04**: New conversations automatically appear in the conversation list without page refresh
- [x] **PUSH-05**: New conversations automatically appear in the overview dashboard without page refresh

### Live Token Usage Widget

- [ ] **WIDG-01**: User sees a floating dismissable pill showing current input and output tokens per minute
- [ ] **WIDG-02**: User can click the pill to expand a larger Chart.js line chart showing token rate over time (input/output as separate series)
- [ ] **WIDG-03**: User can dismiss the widget and restore it via a "Show live usage" button in the sidebar
- [ ] **WIDG-04**: Backend provides a token rate endpoint aggregating recent token usage by minute

### Conversation Timeline

- [ ] **TIME-01**: User sees a collapsible vertical timeline on the right side of the conversation detail page showing key events
- [ ] **TIME-02**: User can click timeline events to scroll to the corresponding position in the conversation
- [ ] **TIME-03**: User can collapse/expand the timeline panel

## Future Requirements

### Realtime Push Enhancements

- **PUSH-06**: Smooth fade/slide-in animation for new messages via TransitionGroup
- **PUSH-07**: Brief pulse animation on metadata header when data updates

### Widget Enhancements

- **WIDG-05**: Cost-per-minute display alongside token rate
- **WIDG-06**: Trend indicator (accelerating/steady/decelerating) label
- **WIDG-07**: Sparkline in compact pill showing last 10 data points

### Timeline Enhancements

- **TIME-04**: Timeline minimap with scroll sync highlighting currently visible section
- **TIME-05**: Per-conversation token rate scoped to the viewed conversation

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mid-response streaming | JSONL logs contain completed turns only; would require fundamentally different parsing |
| WebSocket per-message push (bypass HTTP) | Creates parallel data path; keep notify-then-fetch pattern |
| Persistent WebSocket subscriptions | Broadcast + client-side filter sufficient at localhost scale |
| Real-time typing indicator | Requires agent process hooks; violates read-only model |
| Historical token rate replay | Already served by existing Token Usage Over Time chart |
| Sound notification on new message | Needs settings UI for opt-in toggle; low priority |
| Cursor realtime push | Cursor uses binary SQLite; no incremental diff practical |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PUSH-01 | Phase 32 | Complete |
| PUSH-02 | Phase 31 | Complete |
| PUSH-03 | Phase 32 | Complete |
| PUSH-04 | Phase 33 | Complete |
| PUSH-05 | Phase 33 | Complete |
| WIDG-01 | Phase 34 | Pending |
| WIDG-02 | Phase 34 | Pending |
| WIDG-03 | Phase 34 | Pending |
| WIDG-04 | Phase 34 | Pending |
| TIME-01 | Phase 35 | Pending |
| TIME-02 | Phase 35 | Pending |
| TIME-03 | Phase 35 | Pending |

**Coverage:**
- v2.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 after roadmap creation*
