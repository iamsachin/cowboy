# Requirements: Cowboy v1.3

**Defined:** 2026-03-08
**Core Value:** Give developers a single, unified view of how their coding agents are performing
**Source:** UI Audit Report (2026-03-08) — 54 issues

## v1.3 Requirements

### Critical & Cost Accuracy

- [x] **COST-01**: Cost calculation correctly prices each model separately in multi-model conversations (BUG-01)
- [x] **COST-02**: Cost sort uses actual computed cost, not inputTokens proxy (BUG-02)
- [x] **COST-03**: Header cost uses proper precision formatting instead of toFixed(2) showing $0.00 (CD-08)
- [x] **COST-04**: Token total does not double-count cache tokens (input + output primary, cache separate) (CD-09)
- [x] **COST-05**: Token display shows input + cacheRead for accurate input counts (CD-11)
- [x] **COST-06**: Cost formatting uses a single formatCost() utility everywhere (XC-07)

### Data Accuracy

- [ ] **DATA-01**: Cursor conversations with timestamp 0 use current timestamp as fallback (BUG-03)
- [ ] **DATA-02**: Duration calculated from first-to-last message timestamps, not updatedAt-createdAt (CD-04)
- [ ] **DATA-03**: Turn count label accurately reflects what is counted (CD-05)
- [ ] **DATA-04**: NULL-model conversations backfilled from token_usage records (CL-05)
- [ ] **DATA-05**: Tool durations removed or estimated from message timestamps (AN-01)
- [ ] **DATA-06**: Null-status tool calls classified as "unknown" or excluded from success rate denominator (AN-02)
- [ ] **DATA-07**: ExitPlanMode user rejections distinguished from actual errors (AN-03)
- [ ] **DATA-08**: Heatmap dates consistent (no timezone one-day shift) (AN-04)
- [ ] **DATA-09**: Timeseries groups and filters use consistent timestamp source (AN-07)

### Conversation Display

- [ ] **CONV-01**: System messages do not break assistant turn grouping (BUG-04)
- [ ] **CONV-02**: "0 tool calls" not shown when count is zero (CD-01)
- [ ] **CONV-03**: Preview fallback shows "Assistant response" when no text and 0 tool calls (CD-02)
- [ ] **CONV-04**: Chevron direction follows standard convention (down=expanded) (CD-03)
- [ ] **CONV-05**: Skill/system prompt messages detected by isSystemInjected (CD-06)
- [ ] **CONV-06**: System message indicators reduced or hidden by default (CD-07)
- [ ] **CONV-07**: Expanded AssistantGroupCard has max-height with scroll (CD-10)
- [ ] **CONV-08**: Null/empty content not falsely hidden as system message (CD-12)
- [ ] **CONV-09**: Large conversations paginated or virtualized (CD-13)

### Conversation List

- [ ] **LIST-01**: Titles sanitized with cleanTitle() in list view (CL-01)
- [ ] **LIST-02**: Tokens column sort matches displayed sum (CL-02)
- [ ] **LIST-03**: Project filter fetches full project list from API (CL-03)
- [ ] **LIST-04**: Sort disabled or implemented for unsupported columns (CL-04)
- [ ] **LIST-05**: Search snippet rows don't break zebra striping (CL-06)
- [ ] **LIST-06**: Truncated model names have tooltips (CL-07)
- [ ] **LIST-07**: Loading indicator shown on pagination/sort changes (CL-08)
- [ ] **LIST-08**: Search has visual affordance (button or debounce) (CL-09)
- [ ] **LIST-09**: Search snippet uses DOMPurify instead of regex sanitizer (CL-10)
- [ ] **LIST-10**: formatDate uses local timezone (CL-11)

### Analytics & Agents

- [ ] **ANLYT-01**: Heatmap has color scale legend (AN-05)
- [ ] **ANLYT-02**: Agent filter dropdown populated from API (AN-06)
- [ ] **ANLYT-03**: Cursor shows accurate token/cost data or clear "unavailable" state (AG-01)
- [ ] **ANLYT-04**: Cursor tool calls extracted where available (AG-02)
- [ ] **ANLYT-05**: Compare tab uses appropriate icon (AG-03)
- [ ] **ANLYT-06**: KPI descriptions are contextual, not hardcoded "Awaiting data" (AG-04)
- [ ] **ANLYT-07**: Compare tab skips analytics API call (AG-05)
- [ ] **ANLYT-08**: ComparisonCard uses theme colors instead of hardcoded inline styles (AG-06)

### Plan Extraction

- [ ] **PLAN-01**: Plan titles use meaningful heuristics, not raw text excerpts (PL-01)
- [ ] **PLAN-02**: Markdown artifacts stripped from inferred titles (PL-02)
- [ ] **PLAN-03**: Separate numbered lists not incorrectly merged (PL-03)
- [ ] **PLAN-04**: Action verb filter uses threshold instead of all-or-nothing (PL-04)
- [ ] **PLAN-05**: Loose word matching threshold raised to reduce false completions (PL-05)
- [ ] **PLAN-06**: Re-ingestion updates plan data instead of skipping (PL-06)
- [ ] **PLAN-07**: Sort columns map correctly to backend params (PL-07)
- [ ] **PLAN-08**: "not-started" and "unknown" statuses visually distinct (PL-08)
- [ ] **PLAN-09**: KPI cards don't render empty description div (PL-09)
- [ ] **PLAN-10**: Tool name matching uses word boundaries (PL-10)

### Cross-Cutting & Polish

- [ ] **XCUT-01**: 404/catch-all route added (XC-01)
- [ ] **XCUT-02**: Sidebar collapsed state persisted to localStorage (XC-02)
- [ ] **XCUT-03**: DateRangeFilter respects theme instead of hardcoded dark (XC-03)
- [ ] **XCUT-04**: Chart colors use theme-aware values (XC-04)
- [ ] **XCUT-05**: ChatMessage uses DaisyUI theme colors (XC-05)
- [ ] **XCUT-06**: TurnCard.vue dead code deleted (XC-06)
- [ ] **XCUT-07**: Model badge regex uses word boundary matching (XC-08)
- [ ] **XCUT-08**: TypeScript type for plan API response corrected (XC-09)

### Overview & Settings

- [ ] **PAGE-01**: Overview KPIs labeled with date filter context (OV-01)
- [ ] **PAGE-02**: Table column consistency between Overview and Conversations (OV-02)
- [ ] **PAGE-03**: Empty state shows friendly message instead of zeroed KPIs (OV-03)
- [ ] **PAGE-04**: Settings save shows success toast (ST-01)
- [ ] **PAGE-05**: Danger Zone confirm has countdown or longer timeout (ST-02)
- [ ] **PAGE-06**: Refresh button has confirmation dialog (ST-03)
- [ ] **PAGE-07**: tokenUsage count displayed in db stats (ST-04)

## Future Requirements

None — all audit bugs targeted for v1.3.

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features beyond bug fixes | This milestone is purely quality/fix-focused |
| Architectural refactors | Only change what's needed to fix the bug |
| Light theme implementation | Fix theme-awareness patterns; actual light theme is future work |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| COST-01 | Phase 17 | Complete |
| COST-02 | Phase 17 | Complete |
| COST-03 | Phase 17 | Complete |
| COST-04 | Phase 17 | Complete |
| COST-05 | Phase 17 | Complete |
| COST-06 | Phase 17 | Complete |
| DATA-01 | Phase 18 | Pending |
| DATA-02 | Phase 18 | Pending |
| DATA-03 | Phase 18 | Pending |
| DATA-04 | Phase 18 | Pending |
| DATA-05 | Phase 18 | Pending |
| DATA-06 | Phase 18 | Pending |
| DATA-07 | Phase 18 | Pending |
| DATA-08 | Phase 18 | Pending |
| DATA-09 | Phase 18 | Pending |
| CONV-01 | Phase 19 | Pending |
| CONV-02 | Phase 19 | Pending |
| CONV-03 | Phase 19 | Pending |
| CONV-04 | Phase 19 | Pending |
| CONV-05 | Phase 19 | Pending |
| CONV-06 | Phase 19 | Pending |
| CONV-07 | Phase 19 | Pending |
| CONV-08 | Phase 19 | Pending |
| CONV-09 | Phase 19 | Pending |
| LIST-01 | Phase 20 | Pending |
| LIST-02 | Phase 20 | Pending |
| LIST-03 | Phase 20 | Pending |
| LIST-04 | Phase 20 | Pending |
| LIST-05 | Phase 20 | Pending |
| LIST-06 | Phase 20 | Pending |
| LIST-07 | Phase 20 | Pending |
| LIST-08 | Phase 20 | Pending |
| LIST-09 | Phase 20 | Pending |
| LIST-10 | Phase 20 | Pending |
| PLAN-01 | Phase 21 | Pending |
| PLAN-02 | Phase 21 | Pending |
| PLAN-03 | Phase 21 | Pending |
| PLAN-04 | Phase 21 | Pending |
| PLAN-05 | Phase 21 | Pending |
| PLAN-06 | Phase 21 | Pending |
| PLAN-07 | Phase 21 | Pending |
| PLAN-08 | Phase 21 | Pending |
| PLAN-09 | Phase 21 | Pending |
| PLAN-10 | Phase 21 | Pending |
| ANLYT-01 | Phase 22 | Pending |
| ANLYT-02 | Phase 22 | Pending |
| ANLYT-03 | Phase 22 | Pending |
| ANLYT-04 | Phase 22 | Pending |
| ANLYT-05 | Phase 22 | Pending |
| ANLYT-06 | Phase 22 | Pending |
| ANLYT-07 | Phase 22 | Pending |
| ANLYT-08 | Phase 22 | Pending |
| XCUT-01 | Phase 23 | Pending |
| XCUT-02 | Phase 23 | Pending |
| XCUT-03 | Phase 23 | Pending |
| XCUT-04 | Phase 23 | Pending |
| XCUT-05 | Phase 23 | Pending |
| XCUT-06 | Phase 23 | Pending |
| XCUT-07 | Phase 23 | Pending |
| XCUT-08 | Phase 23 | Pending |
| PAGE-01 | Phase 24 | Pending |
| PAGE-02 | Phase 24 | Pending |
| PAGE-03 | Phase 24 | Pending |
| PAGE-04 | Phase 24 | Pending |
| PAGE-05 | Phase 24 | Pending |
| PAGE-06 | Phase 24 | Pending |
| PAGE-07 | Phase 24 | Pending |

**Coverage:**
- v1.3 requirements: 67 total
- Mapped to phases: 67
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after roadmap creation*
