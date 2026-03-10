# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v2.1 — Realtime & Live Insights

**Shipped:** 2026-03-10
**Phases:** 5 | **Plans:** 10

### What Was Built
- Typed WebSocket event infrastructure with discriminated union types, sequence gap detection, and conversation-scoped routing
- Realtime conversation detail — debounced refetch, scroll preservation, fade-in animation, new messages pill, green pulse-dot
- Realtime conversation discovery — auto-appearing rows in list and overview with green oklch fade-in highlight
- Floating live token usage widget — dismissable pill, expandable Chart.js line chart, sidebar restore button
- Collapsible conversation timeline — vertical sidebar with color-coded event dots, click-to-scroll navigation, IntersectionObserver active tracking

### What Worked
- Discriminated union type for WebSocket events — TypeScript narrows payload by event type, zero runtime overhead
- Pre/post snapshot diff for ingestion changes — detects granular change categories without full payload comparison
- on() auto-cleanup via onScopeDispose — consumers never need explicit WS unsubscription
- Separate loading/refreshing refs — prevents jarring full-page spinners during live data updates
- Singleton composable pattern reused for useTokenRate (module-level dismissed ref shared between pill and sidebar)
- IntersectionObserver for timeline tracking — efficient scroll-to-event mapping without scroll event handlers

### What Was Inefficient
- SUMMARY.md files still lack `one_liner` frontmatter across all phases — automated accomplishment extraction returns null
- SUMMARY.md files missing `requirements-completed` frontmatter field (noted in audit tech debt)
- Vitest + happy-dom v20 required localStorage polyfill workaround in setup.ts

### Patterns Established
- Typed event router: Map-based listener registry with on(type, callback) API replacing flat onDataChanged
- Debounced WS refetch: 500ms debounce with at-most-1-in-flight + 1-queued pattern for all composables
- newIds transient tracking: Set populated on refetch, auto-cleared after 2000ms for highlight animation
- Dual useScrollTracker: independent scroll behavior instances for main content and auxiliary panels
- Lazy-hydrated singleton: localStorage read deferred to first composable call for test environment compatibility

### Key Lessons
1. Conversation-scoped events are essential — broadcasting "something changed" creates unnecessary refetches on unrelated pages
2. Sequence gap detection (monotonic counter) provides reliable catch-up without complex state reconciliation
3. Separate loading/refreshing refs is a universally applicable pattern for any live-updating list/detail view
4. IntersectionObserver is better than scroll event listeners for tracking which content is visible in a scrolling container

### Cost Observations
- Model mix: sonnet for executors/verifier, opus for orchestration
- All 10 plans completed in single day (2026-03-10)
- Notable: Phase 31 (infrastructure) and Phase 33 (discovery) completed fastest — well-defined scope with clear boundaries

---

## Milestone: v2.0 — UX Overhaul

**Shipped:** 2026-03-09
**Phases:** 6 | **Plans:** 13

### What Was Built
- Streaming deduplication (replace-not-append) and XML sanitization for clean data pipeline
- Purpose-built tool viewers — LCS diff for Edit, syntax-highlighted code for Read/Write, terminal for Bash, JSON fallback
- Keyboard-driven navigation — in-conversation search (Cmd+F), command palette (Cmd+K), J/K/E shortcuts, cheat sheet
- Collapsed card previews with rendered markdown, file basenames, tool summaries
- Compaction detection with amber boundary markers showing token deltas
- Subagent resolution with three-phase matching, inline summary cards, parent/child navigation
- Code cleanup: dead ToolCallCard.vue removal, shared markdown CSS, consolidated cost formatters

### What Worked
- Component dispatcher pattern (ToolCallRow) — reduced 151 lines to 48 by moving tool-specific logic into dedicated viewer components
- Hand-rolled utilities over external deps — LCS diff (77 lines), file-lang-map (67 lines) avoided dependency overhead
- Singleton composable pattern for keyboard shortcuts — clean registration/unregistration lifecycle across pages
- Post-ingestion linking for subagents — avoided ordering dependencies and kept ingestion transaction simple
- Belt-and-suspenders data cleanup — XML stripped at both ingestion (backend) and display (frontend) time

### What Was Inefficient
- SUMMARY.md files lack `one_liner` frontmatter across all phases — automated accomplishment extraction returns null for every plan
- Nyquist validation files created but left in draft status — all 6 phases have VALIDATION.md but none were completed
- Quick tasks tracked in STATE.md have inconsistent format (some have timing data, some don't)

### Patterns Established
- Tool viewer dispatcher: v-if chain in ToolCallRow dispatches to specialized components by tool name
- TreeWalker DOM search: text node splitting for match highlighting preserves DOM structure
- Post-ingestion linking: complex cross-entity relationships (subagents) resolved after all data is in DB
- Confidence-based matching: three-phase degradation (agentId → description → position) with visual confidence hints
- Compaction injection: post-processing step after groupTurns preserves existing grouping logic

### Key Lessons
1. Replace-not-append is the correct pattern for cumulative JSONL streaming — Claude Code appends chunks, not discrete messages
2. Hand-rolled algorithms (LCS diff, language mapper) work well for bounded problems; add size guards (500-line cap) for safety
3. Post-ingestion linking is simpler than in-flight linking when you need cross-entity resolution
4. Belt-and-suspenders cleanup (backend + frontend) catches data quality issues regardless of when data was ingested

### Cost Observations
- Model mix: sonnet for executors/verifier/integration-checker, opus for orchestration
- All 13 plans completed in single day (2026-03-09)
- Notable: Phase 25 (cleanup) and Phase 26 (display) completed fastest — well-scoped changes on existing patterns

---

## Milestone: v1.1 — Conversation View Polish

**Shipped:** 2026-03-05
**Phases:** 4 | **Plans:** 8

### What Was Built
- Turn grouping algorithm (groupTurns) with orphan handling and typed Turn objects
- Two-level collapsible UI with AssistantGroupCard, summary headers, expand/collapse all
- Per-turn token counts and estimated cost from backend SUM GROUP BY messageId
- Tool call type icons (8 types) and color-coded model badges with oklch CSS

### What Worked
- TDD approach for groupTurns pure function — 10 tests caught edge cases before UI work
- Reactive Map for collapse state — clean separation of state management from DOM
- Progressive disclosure pattern reduces visual noise while keeping all data accessible
- Backend token aggregation via existing tokenUsage table FK — no schema changes needed

### What Was Inefficient
- TurnCard.vue became orphaned when AssistantGroupCard was created during visual verification — thinking section wasn't ported over, caught only during verification
- Phase 11 VERIFICATION report became stale after post-verification fix was applied
- Some plan SUMMARY.md files lack one_liner frontmatter field, making automated accomplishment extraction fail

### Patterns Established
- AssistantGroupCard pattern: merge consecutive assistant turns into single collapsible block
- details/summary for nested collapsibles (avoid DaisyUI checkbox collapse nesting bugs)
- oklch soft-tint color system for badge styling across themes
- Ordered substring matchers for model label resolution (gpt-4o before gpt-4)

### Key Lessons
1. When creating replacement components during visual verification, explicitly check what features the original had that need porting
2. Verification reports should be re-run after any post-verification fixes to keep status accurate
3. Pure functions with comprehensive unit tests make UI integration much smoother

### Cost Observations
- Model mix: primarily sonnet for agents, opus for orchestration
- All 8 plans completed in single day
- Notable: Phase 13 (visual polish) completed in 2min — well-scoped utility-only changes

---

## Milestone: v1.2 — Data Quality & Display Fixes

**Shipped:** 2026-03-05
**Phases:** 3 | **Plans:** 6

### What Was Built
- Shared title-utils module with skip logic for system caveats, interruptions, and slash commands
- Conversation-level model derivation from token usage when NULL; Cursor "default" → "unknown"
- Idempotent startup migrations retroactively fixing titles, models, Cursor projects, and content
- Cursor assistant content extraction with tool activity summaries
- System message indicators (expandable pills with category badges)
- Slash command chips and /clear context-reset dividers
- Cursor agent in conversation filter dropdown

### What Worked
- Shared utility pattern (title-utils.ts) avoided duplicating skip logic across normalizers
- Idempotent migration pattern — runs every cycle, no bookkeeping flags, self-correcting
- TDD for groupTurns extension — 24 tests (14 new) caught classification edge cases before UI work
- Browser automation (agent-browser) for visual verification — faster and more thorough than manual checking

### What Was Inefficient
- Some SUMMARY.md files still lack `one_liner` frontmatter field — automated accomplishment extraction returns null
- Phase 15/16 plan checkboxes in ROADMAP.md weren't updated to [x] by executors (cosmetic)

### Patterns Established
- Startup migration pattern: idempotent data quality fixes hooked into ingestion cycle
- Turn classification precedence chain: isClearCommand → isSlashCommand → isSystemInjected → UserTurn
- In-flow expansion for indicators inside scroll containers (avoids absolute/z-index issues)
- groupTurns as single source of truth for all message classification (removed filteredMessages)

### Key Lessons
1. Idempotent migrations are simpler and more robust than one-time flags — just run every time
2. Browser automation testing catches visual regressions that unit tests cannot
3. When extending a grouping/classification system, update ALL consumers (removed stale filteredMessages)

### Cost Observations
- Model mix: sonnet for executors and verifier, opus for orchestration
- All 6 plans completed same day as milestone start
- Notable: Phase 14 (ingestion quality) completed fastest — pure backend work, no UI verification needed

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.0 | 9 | 24 | Established full project from scratch |
| v1.1 | 4 | 8 | Polish/enhancement cycle on existing codebase |
| v1.2 | 3 | 6 | Data quality fixes + new UI components for system content |
| v1.3 | 8 | 21 | Bug fix audit — 67 issues fixed across every page |
| v2.0 | 6 | 13 | Feature-rich UX overhaul — viewers, navigation, subagents |
| v2.1 | 5 | 10 | Realtime push, live monitoring, timeline navigation |

### Cumulative Quality

| Milestone | Tests Added | Key Patterns |
|-----------|-------------|--------------|
| v1.0 | Integration + unit tests across all phases | TDD for parsers, seed fixtures for API tests |
| v1.1 | 51 new tests (groupTurns, collapseState, turnHelpers, toolIcons, modelLabels) | TDD-first for pure functions |
| v1.2 | 24 tests (14 new for system message grouping/classification) | TDD for groupTurns extension, browser automation for visual verification |
| v1.3 | Extensive verification-driven testing across 8 phases | Goal-backward verification ensuring observable truths |
| v2.0 | 100+ tests (LCS diff, lang mapper, turn helpers, search, palette, keyboard, compaction, subagent linker) | TDD for all utility functions; component viewers tested via guard computeds |
| v2.1 | 42+ tests (debounce, queue, scroll tracker, group tracking, WS refetch, newIds, token rate, timeline events) | TDD for composables; localStorage polyfill for happy-dom v20 |

### Top Lessons (Verified Across Milestones)

1. TDD for pure logic functions consistently catches edge cases before integration
2. Seed fixture pattern for backend tests enables reliable, repeatable API testing
3. Idempotent migrations are simpler than one-time flags — verified across v1.2 phases 14 and 15
4. Component dispatcher pattern keeps hub components small while individual viewers own their complexity (v2.0)
5. Post-ingestion linking is simpler than in-flight resolution for cross-entity relationships (v2.0)
6. Conversation-scoped WS events prevent unnecessary refetches; separate loading/refreshing refs prevent UI jank (v2.1)
