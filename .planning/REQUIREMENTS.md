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

- [x] **DATA-01**: Cursor conversations with timestamp 0 use current timestamp as fallback (BUG-03)
- [x] **DATA-02**: Duration calculated from first-to-last message timestamps, not updatedAt-createdAt (CD-04)
- [x] **DATA-03**: Turn count label accurately reflects what is counted (CD-05)
- [x] **DATA-04**: NULL-model conversations backfilled from token_usage records (CL-05)
- [x] **DATA-05**: Tool durations removed or estimated from message timestamps (AN-01)
- [x] **DATA-06**: Null-status tool calls classified as "unknown" or excluded from success rate denominator (AN-02)
- [x] **DATA-07**: ExitPlanMode user rejections distinguished from actual errors (AN-03)
- [x] **DATA-08**: Heatmap dates consistent (no timezone one-day shift) (AN-04)
- [x] **DATA-09**: Timeseries groups and filters use consistent timestamp source (AN-07)

### Conversation Display

- [x] **CONV-01**: System messages do not break assistant turn grouping (BUG-04)
- [x] **CONV-02**: "0 tool calls" not shown when count is zero (CD-01)
- [x] **CONV-03**: Preview fallback shows "Assistant response" when no text and 0 tool calls (CD-02)
- [x] **CONV-04**: Chevron direction follows standard convention (down=expanded) (CD-03)
- [x] **CONV-05**: Skill/system prompt messages detected by isSystemInjected (CD-06)
- [x] **CONV-06**: System message indicators reduced or hidden by default (CD-07)
- [x] **CONV-07**: Expanded AssistantGroupCard has max-height with scroll (CD-10)
- [x] **CONV-08**: Null/empty content not falsely hidden as system message (CD-12)
- [x] **CONV-09**: Large conversations paginated or virtualized (CD-13)

### Conversation List

- [x] **LIST-01**: Titles sanitized with cleanTitle() in list view (CL-01)
- [x] **LIST-02**: Tokens column sort matches displayed sum (CL-02)
- [x] **LIST-03**: Project filter fetches full project list from API (CL-03)
- [x] **LIST-04**: Sort disabled or implemented for unsupported columns (CL-04)
- [x] **LIST-05**: Search snippet rows don't break zebra striping (CL-06)
- [x] **LIST-06**: Truncated model names have tooltips (CL-07)
- [x] **LIST-07**: Loading indicator shown on pagination/sort changes (CL-08)
- [x] **LIST-08**: Search has visual affordance (button or debounce) (CL-09)
- [x] **LIST-09**: Search snippet uses DOMPurify instead of regex sanitizer (CL-10)
- [x] **LIST-10**: formatDate uses local timezone (CL-11)

### Analytics & Agents

- [x] **ANLYT-01**: Heatmap has color scale legend (AN-05)
- [x] **ANLYT-02**: Agent filter dropdown populated from API (AN-06)
- [x] **ANLYT-03**: Cursor shows accurate token/cost data or clear "unavailable" state (AG-01)
- [x] **ANLYT-04**: Cursor tool calls extracted where available (AG-02)
- [x] **ANLYT-05**: Compare tab uses appropriate icon (AG-03)
- [x] **ANLYT-06**: KPI descriptions are contextual, not hardcoded "Awaiting data" (AG-04)
- [x] **ANLYT-07**: Compare tab skips analytics API call (AG-05)
- [x] **ANLYT-08**: ComparisonCard uses theme colors instead of hardcoded inline styles (AG-06)

### Plan Extraction

- [x] **PLAN-01**: Plan titles use meaningful heuristics, not raw text excerpts (PL-01)
- [x] **PLAN-02**: Markdown artifacts stripped from inferred titles (PL-02)
- [x] **PLAN-03**: Separate numbered lists not incorrectly merged (PL-03)
- [x] **PLAN-04**: Action verb filter uses threshold instead of all-or-nothing (PL-04)
- [x] **PLAN-05**: Loose word matching threshold raised to reduce false completions (PL-05)
- [x] **PLAN-06**: Re-ingestion updates plan data instead of skipping (PL-06)
- [x] **PLAN-07**: Sort columns map correctly to backend params (PL-07)
- [x] **PLAN-08**: "not-started" and "unknown" statuses visually distinct (PL-08)
- [x] **PLAN-09**: KPI cards don't render empty description div (PL-09)
- [x] **PLAN-10**: Tool name matching uses word boundaries (PL-10)

### Cross-Cutting & Polish

- [x] **XCUT-01**: 404/catch-all route added (XC-01)
- [x] **XCUT-02**: Sidebar collapsed state persisted to localStorage (XC-02)
- [x] **XCUT-03**: DateRangeFilter respects theme instead of hardcoded dark (XC-03)
- [x] **XCUT-04**: Chart colors use theme-aware values (XC-04)
- [x] **XCUT-05**: ChatMessage uses DaisyUI theme colors (XC-05)
- [x] **XCUT-06**: TurnCard.vue dead code deleted (XC-06)
- [x] **XCUT-07**: Model badge regex uses word boundary matching (XC-08)
- [x] **XCUT-08**: TypeScript type for plan API response corrected (XC-09)

### Overview & Settings

- [x] **PAGE-01**: Overview KPIs labeled with date filter context (OV-01)
- [x] **PAGE-02**: Table column consistency between Overview and Conversations (OV-02)
- [x] **PAGE-03**: Empty state shows friendly message instead of zeroed KPIs (OV-03)
- [x] **PAGE-04**: Settings save shows success toast (ST-01)
- [x] **PAGE-05**: Danger Zone confirm has countdown or longer timeout (ST-02)
- [x] **PAGE-06**: Refresh button has confirmation dialog (ST-03)
- [x] **PAGE-07**: tokenUsage count displayed in db stats (ST-04)

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
| DATA-01 | Phase 18 | Complete |
| DATA-02 | Phase 18 | Complete |
| DATA-03 | Phase 18 | Complete |
| DATA-04 | Phase 18 | Complete |
| DATA-05 | Phase 18 | Complete |
| DATA-06 | Phase 18 | Complete |
| DATA-07 | Phase 18 | Complete |
| DATA-08 | Phase 18 | Complete |
| DATA-09 | Phase 18 | Complete |
| CONV-01 | Phase 19 | Complete |
| CONV-02 | Phase 19 | Complete |
| CONV-03 | Phase 19 | Complete |
| CONV-04 | Phase 19 | Complete |
| CONV-05 | Phase 19 | Complete |
| CONV-06 | Phase 19 | Complete |
| CONV-07 | Phase 19 | Complete |
| CONV-08 | Phase 19 | Complete |
| CONV-09 | Phase 19 | Complete |
| LIST-01 | Phase 20 | Complete |
| LIST-02 | Phase 20 | Complete |
| LIST-03 | Phase 20 | Complete |
| LIST-04 | Phase 20 | Complete |
| LIST-05 | Phase 20 | Complete |
| LIST-06 | Phase 20 | Complete |
| LIST-07 | Phase 20 | Complete |
| LIST-08 | Phase 20 | Complete |
| LIST-09 | Phase 20 | Complete |
| LIST-10 | Phase 20 | Complete |
| PLAN-01 | Phase 21 | Complete |
| PLAN-02 | Phase 21 | Complete |
| PLAN-03 | Phase 21 | Complete |
| PLAN-04 | Phase 21 | Complete |
| PLAN-05 | Phase 21 | Complete |
| PLAN-06 | Phase 21 | Complete |
| PLAN-07 | Phase 21 | Complete |
| PLAN-08 | Phase 21 | Complete |
| PLAN-09 | Phase 21 | Complete |
| PLAN-10 | Phase 21 | Complete |
| ANLYT-01 | Phase 22 | Complete |
| ANLYT-02 | Phase 22 | Complete |
| ANLYT-03 | Phase 22 | Complete |
| ANLYT-04 | Phase 22 | Complete |
| ANLYT-05 | Phase 22 | Complete |
| ANLYT-06 | Phase 22 | Complete |
| ANLYT-07 | Phase 22 | Complete |
| ANLYT-08 | Phase 22 | Complete |
| XCUT-01 | Phase 23 | Complete |
| XCUT-02 | Phase 23 | Complete |
| XCUT-03 | Phase 23 | Complete |
| XCUT-04 | Phase 23 | Complete |
| XCUT-05 | Phase 23 | Complete |
| XCUT-06 | Phase 23 | Complete |
| XCUT-07 | Phase 23 | Complete |
| XCUT-08 | Phase 23 | Complete |
| PAGE-01 | Phase 24 | Complete |
| PAGE-02 | Phase 24 | Complete |
| PAGE-03 | Phase 24 | Complete |
| PAGE-04 | Phase 24 | Complete |
| PAGE-05 | Phase 24 | Complete |
| PAGE-06 | Phase 24 | Complete |
| PAGE-07 | Phase 24 | Complete |

**Coverage:**
- v1.3 requirements: 67 total
- Mapped to phases: 67
- Unmapped: 0

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after roadmap creation*
