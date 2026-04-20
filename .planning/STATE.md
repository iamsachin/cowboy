---
gsd_state_version: 1.0
milestone: v3.1
milestone_name: Remove Cursor Support
status: shipped
stopped_at: Milestone v3.1 archived and tagged
last_updated: "2026-03-28T16:00:00.000Z"
last_activity: 2026-03-28 — Milestone v3.1 archived and tagged
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 6
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-28)

**Core value:** Give developers a single, unified view of how their coding agents are performing
**Current focus:** Planning next milestone

## Current Position

Status: v3.1 milestone shipped. All 8 milestones complete (46 phases, 103 plans).
Last activity: 2026-04-20 - Completed quick task 260420-o2z: Change subagent pills to solid tag style.

## Performance Metrics

**Velocity:**
- v1.0: 24 plans, ~124min total, ~5min avg
- v1.1: 8 plans, 4 phases
- v1.2: 6 plans, 3 phases
- v1.3: 21 plans, 8 phases
- v2.0: 13 plans, 6 phases
- v2.1: 10 plans, 5 phases
- v3.0: 15 plans, 5 phases
- v3.1: 6 plans, 6 phases, 12 tasks, 18 commits
- Total plans completed: 103

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
(Full decision log in PROJECT.md Key Decisions table)

### Pending Todos

None.

### Blockers/Concerns

- 10 pre-existing Rust compiler warnings (dead code/unused imports)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 7 | Disable chart animations when data updates | 2026-03-08 | 7b27913 | [7-disable-chart-animations-when-data-updat](./quick/7-disable-chart-animations-when-data-updat/) |
| 8 | Liven up sidebar with stats strip, tagline, tips | 2026-03-08 | 1398e2f | [8-liven-up-sidebar-with-stats-strip-taglin](./quick/8-liven-up-sidebar-with-stats-strip-taglin/) |
| 9 | Add cowboy hat SVG logo and humorous tagline | 2026-03-08 | 9b5ed27 | [9-add-cowboy-hat-svg-logo-and-humorous-cow](./quick/9-add-cowboy-hat-svg-logo-and-humorous-cow/) |
| 10 | Show blinking green circle for active conversations | 2026-03-08 | 844637c | [10-show-blinking-green-circle-indicator-for](./quick/10-show-blinking-green-circle-indicator-for/) |
| 11 | Fix chart re-rendering flash with v-show | 2026-03-08 | 7ae59b3 | [11-fix-chart-re-rendering-on-data-push-with](./quick/11-fix-chart-re-rendering-on-data-push-with/) |
| 12 | Fix Cursor data extraction (thinking, capabilityType, turn merging) | 2026-03-09 | a62b878 | [12-fix-cursor-data-extraction-analyze-db-st](./quick/12-fix-cursor-data-extraction-analyze-db-st/) |
| 13 | Extract Cursor tool call data from toolFormerData | 2026-03-09 | 94314c1 | [13-extract-cursor-tool-call-data-from-toolf](./quick/13-extract-cursor-tool-call-data-from-toolf/) |
| 14 | Render thinking content as styled markdown | 2026-03-09 | a9b8d1e | [14-in-the-thinking-portion-we-must-display-](./quick/14-in-the-thinking-portion-we-must-display-/) |
| 15 | Fix pill badge responsiveness on smaller screens | 2026-03-10 | 5964738 | [15-fix-pill-badge-responsiveness-on-smaller](./quick/15-fix-pill-badge-responsiveness-on-smaller/) |
| 16 | Preserve pagination state when navigating back | 2026-03-10 | aede542 | [16-preserve-pagination-state-when-navigatin](./quick/16-preserve-pagination-state-when-navigatin/) |
| 17 | Fix active conversation marking for all conversations | 2026-03-10 | 51d09b1 | [17-fix-active-conversation-marking-all-conv](./quick/17-fix-active-conversation-marking-all-conv/) |
| 18 | Use icons instead of dots for timeline events | 2026-03-10 | bb50c4f | [18-use-icons-instead-of-dots-for-different-](./quick/18-use-icons-instead-of-dots-for-different-/) |
| 19 | Make search bar sticky below toolbar | 2026-03-10 | 0d69e68 | [19-make-search-bar-sticky-floating-so-it-st](./quick/19-make-search-bar-sticky-floating-so-it-st/) |
| 20 | Move pagination buttons to left side | 2026-03-10 | 50d3b2f | [20-move-pagination-buttons-to-left-side-to-](./quick/20-move-pagination-buttons-to-left-side-to-/) |
| 21 | Fix title overflow and auto-expand single assistant group | 2026-03-10 | 76f2928 | [21-fix-title-overflow-and-auto-expand-singl](./quick/21-fix-title-overflow-and-auto-expand-singl/) |
| 22 | Fix slow app boot and hard refresh performance | 2026-03-10 | 7563cc3 | [22-fix-slow-app-boot-and-hard-refresh-perfo](./quick/22-fix-slow-app-boot-and-hard-refresh-perfo/) |
| 23 | Show conversations with parent ID as sub-rows | 2026-03-10 | 708fe92 | [23-show-conversations-with-parent-id-as-sub](./quick/23-show-conversations-with-parent-id-as-sub/) |
| 24 | Fix sub-conversations connected to wrong parent | 2026-03-10 | f9ac27d | [24-fix-sub-conversations-connected-to-wrong](./quick/24-fix-sub-conversations-connected-to-wrong/) |
| 25 | Handle /clear as first message - title fix and banner | 2026-03-11 | 450e304 | [25-handle-clear-clear-as-first-message-show](./quick/25-handle-clear-clear-as-first-message-show/) |
| 26 | Fix tool output showing (none) and token display | 2026-03-14 | ac13de7 | [26-fix-tool-output-showing-none-show-last-a](./quick/26-fix-tool-output-showing-none-show-last-a/) |
| 27 | Fix token display, conversation title, and timeline scroll | 2026-03-14 | 84b3c5d | [27-fix-output-token-count-conversation-titl](./quick/27-fix-output-token-count-conversation-titl/) |
| 28 | Research claude-devtools conversation display improvements | 2026-03-28 | 404954d | [28-research-claude-devtools-conversation-di](./quick/28-research-claude-devtools-conversation-di/) |
| 29 | Implement conversation display improvements from claude-devtools | 2026-03-28 | 6a3864e | [29-implement-conversation-display-improveme](./quick/29-implement-conversation-display-improveme/) |
| 30 | Deep source-level analysis of claude-devtools conversation display | 2026-03-28 | 3945556 | [30-research-claude-devtools-conversation-di](./quick/30-research-claude-devtools-conversation-di/) |
| 31 | Conversation display improvements (token popover, expandable item, subagent dashboard) | 2026-03-28 | a4bf8da | [31-implement-conversation-display-improveme](./quick/31-implement-conversation-display-improveme/) |
| 32 | Fix Open full conversation link not working in subagent cards | 2026-03-28 | 2a35d9d | [32-fix-open-full-conversation-link-not-work](./quick/32-fix-open-full-conversation-link-not-work/) |
| 33 | Move floating live status to bottom of left nav | 2026-03-28 | 12bd37f | [33-move-floating-live-status-to-bottom-of-l](./quick/33-move-floating-live-status-to-bottom-of-l/) |
| 34 | Add top 3 most expensive conversations widget to Overview | 2026-03-28 | 2eeaf68 | [34-add-top-3-most-expensive-conversations-w](./quick/34-add-top-3-most-expensive-conversations-w/) |
| 35 | Add light/dark mode toggle to sidebar | 2026-03-28 | e751b3b | [35-add-light-dark-mode-toggle-to-sidebar](./quick/35-add-light-dark-mode-toggle-to-sidebar/) |
| 36 | Add release skill for app and Homebrew distribution | 2026-03-30 | 01c9d2d | [36-add-release-skill-for-app-and-homebrew-d](./quick/36-add-release-skill-for-app-and-homebrew-d/) |
| 37 | Extract plans only from ExitPlanMode tool calls | 2026-03-30 | 603dd4a | [37-extract-plans-only-from-claude-code-plan](./quick/37-extract-plans-only-from-claude-code-plan/) |
| 38 | Fix window drag z-index conflict | 2026-03-30 | aec81ab | [38-i-am-unable-to-hold-and-drag-the-window](./quick/38-i-am-unable-to-hold-and-drag-the-window/) |
| 39 | Add loading progress bar and error display | 2026-03-30 | a9eabcc | [39-add-loading-progress-bar-and-error-displ](./quick/39-add-loading-progress-bar-and-error-displ/) |
| 40 | Fix window dragging - top of window not draggable | 2026-03-30 | 8cd75e4 | [40-fix-window-dragging-top-of-window-not-dr](./quick/40-fix-window-dragging-top-of-window-not-dr/) |
| 41 | Skill-aware conversation UI - show skill invocation badge and fix titles | 2026-03-31 | 63c6036 | [41-skill-aware-conversation-ui-show-skill-i](./quick/41-skill-aware-conversation-ui-show-skill-i/) |
| 42 | Fix activity heatmap colors for both themes | 2026-03-31 | 4c22aac | [42-the-activity-github-like-dot-graph-has-c](./quick/42-the-activity-github-like-dot-graph-has-c/) |
| 43 | Fix skill pill placement and timeline layout | 2026-03-31 | b00c025 | [43-fix-skill-pill-placement-in-conversation](./quick/43-fix-skill-pill-placement-in-conversation/) |
| 44 | Fix token rate speed and rounded legend indicators | 2026-03-30 | cbe3454 | [44-fix-token-rate-speed-to-show-current-val](./quick/44-fix-token-rate-speed-to-show-current-val/) |
| 45 | Make tooltip legends roundish like the top legends | 2026-03-31 | 910555a | [45-make-tooltip-legends-roundish-like-the-t](./quick/45-make-tooltip-legends-roundish-like-the-t/) |
| 45 | Make tooltip legends round to match top legend style | 2026-03-31 | 910555a | [45-make-tooltip-legends-roundish-like-the-t](./quick/45-make-tooltip-legends-roundish-like-the-t/) |
| 46 | Narrow conversation content when timeline sidebar is open | 2026-03-31 | 043bf55 | [46-narrow-conversation-content-when-timelin](./quick/46-narrow-conversation-content-when-timelin/) |
| 47 | Hide last message preview when card is expanded | 2026-03-31 | 9b657e4 | [47-hide-last-message-on-outside-when-card-i](./quick/47-hide-last-message-on-outside-when-card-i/) |
| 48 | Hide synthetic model badge when no LLM call | 2026-03-31 | 48f624c | [48-hide-synthetic-model-badge-when-llm-call](./quick/48-hide-synthetic-model-badge-when-llm-call/) |
| 49 | Fix title from slash command args and highlight commands | 2026-03-31 | 82582cc | [49-fix-title-from-slash-command-args-and-hi](./quick/49-fix-title-from-slash-command-args-and-hi/) |
| 50 | Add ticker-style animated number counting to KPI cards | 2026-03-31 | 031a6c9 | [50-add-ticker-style-animated-number-countin](./quick/50-add-ticker-style-animated-number-countin/) |
| 51 | Fix conversation title to use first user message after /clear | 2026-03-31 | 702743d | [51-fix-conversation-title-to-use-first-user](./quick/51-fix-conversation-title-to-use-first-user/) |
| 52 | Add signing and notarization to release script | 2026-04-03 | b713290 | [52-add-signing-and-notarization-to-release-](./quick/52-add-signing-and-notarization-to-release-/) |
| 53 | Trace real-time data flow pipeline end-to-end | 2026-04-03 | 42fa51d | [53-understand-the-flow-which-adds-new-data-](./quick/53-understand-the-flow-which-adds-new-data-/) |
| 54 | Fix markdown rendering and auto-expand last assistant group | 2026-04-03 | 910eaff | [54-fix-markdown-rendering-numbered-lists-an](./quick/54-fix-markdown-rendering-numbered-lists-an/) |
| 55 | Remove Plans feature from nav and all references | 2026-04-03 | 779b1ec | [55-remove-plan-feature-from-nav-and-all-exc](./quick/55-remove-plan-feature-from-nav-and-all-exc/) |
| 56 | Auto-expand last tool call and colorize markdown | 2026-04-03 | d1cdf5d | [56-auto-expand-last-tool-call-in-assistant-](./quick/56-auto-expand-last-tool-call-in-assistant-/) |
| 57 | Fix timeline full height, scroll position, and light theme legibility | 2026-04-03 | f7c8276 | [57-fix-timeline-full-height-scroll-position](./quick/57-fix-timeline-full-height-scroll-position/) |
| 58 | Animate new messages with slide-up TransitionGroup | 2026-04-03 | 9d60f10 | [58-animate-new-messages-sliding-up-instead-](./quick/58-animate-new-messages-sliding-up-instead-/) |
| 59 | Timeline rounded corners, right margin, and light theme line fix | 2026-04-03 | 07bc182 | [59-timeline-rounded-corners-right-margin-fi](./quick/59-timeline-rounded-corners-right-margin-fi/) |
| 60 | Timeline positioning, skill tool call titles, and status badges | 2026-04-03 | 00b850d | [60-timeline-positioning-skill-tool-call-tit](./quick/60-timeline-positioning-skill-tool-call-tit/) |
| 61 | Convert token rate chart to always-visible sidebar card | 2026-04-03 | f048633 | [61-convert-token-rate-chart-and-speed-into-](./quick/61-convert-token-rate-chart-and-speed-into-/) |
| 62 | Improve usage chart visibility in dark/light themes | 2026-04-03 | 1468c94 | [62-improve-usage-chart-visibility-dark-ligh](./quick/62-improve-usage-chart-visibility-dark-ligh/) |
| 63 | Center timeline panel and align top with title card | 2026-04-03 | bb267af | [63-center-timeline-panel-and-align-top-with](./quick/63-center-timeline-panel-and-align-top-with/) |
| 64 | Fix theme toggle hover background | 2026-04-03 | bf2f34a | [64-fix-the-background-hover-of-the-theme-bu](./quick/64-fix-the-background-hover-of-the-theme-bu/) |
| 65 | Move tool call cost/token info to right side | 2026-04-04 | c2b0a66 | [65-move-tool-call-cost-token-info-to-right-](./quick/65-move-tool-call-cost-token-info-to-right-/) |
| 66 | Fix conversation detail badges: remove skill, reorder project first, align icons, fix export | 2026-04-03 | 2318684 | [66-fix-conversation-detail-badges-remove-sk](./quick/66-fix-conversation-detail-badges-remove-sk/) |
| 67 | Hide image-only entries from conversation timeline | 2026-04-04 | 8596473 | [67-hide-conversation-history-items-that-onl](./quick/67-hide-conversation-history-items-that-onl/) |
| 68 | Make graph taller, remove tips, show active conversations | 2026-04-04 | ffe1143 | [68-make-the-graph-taller-remove-tips-show-a](./quick/68-make-the-graph-taller-remove-tips-show-a/) |
| 69 | Hide agent and project columns for subagent rows | 2026-04-04 | 7dde086 | [69-hide-agent-and-project-columns-for-subag](./quick/69-hide-agent-and-project-columns-for-subag/) |
| 70 | Move title to first column in overview and browser tables | 2026-04-04 | f3fe16b | [70-move-title-to-first-column-in-overview-a](./quick/70-move-title-to-first-column-in-overview-a/) |
| 71 | Use command args as conversation title (pass 0) | 2026-04-04 | 8e21dfa | [71-use-command-args-as-conversation-title-f](./quick/71-use-command-args-as-conversation-title-f/) |
| 72 | Remove Agents nav item and everything related | 2026-04-04 | f92c2bf | [72-remove-the-agents-nav-item-and-everythin](./quick/72-remove-the-agents-nav-item-and-everythin/) |
| 73 | Make timeline bar width responsive to container space | 2026-04-06 | 793e30b | [73-make-timeline-bar-width-responsive-to-co](./quick/73-make-timeline-bar-width-responsive-to-co/) |
| 74 | Move orphaned skill definition system messages inline | 2026-04-06 | 15830e2 | [74-move-orphaned-skill-definition-system-me](./quick/74-move-orphaned-skill-definition-system-me/) |
| 75 | Fix useScrollTracker late-binding ref issue | 2026-04-06 | e5061e3 | [75-fix-parallel-agent-display-in-chat-timel](./quick/75-fix-parallel-agent-display-in-chat-timel/) |
| 76 | Show current conversation in system tray panel | 2026-04-07 | 2ed3f3f | [76-show-current-conversation-in-system-tray](./quick/76-show-current-conversation-in-system-tray/) |
| 77 | Fix timeline overlapping conversation area on narrow viewports | 2026-04-07 | e106bdc | [77-fix-timeline-overlapping-conversation-ar](./quick/77-fix-timeline-overlapping-conversation-ar/) |
| 78 | Fix auto-scroll losing bottom during rapid streaming | 2026-04-07 | 45bc211 | [78-fix-auto-scroll-losing-bottom-during-rap](./quick/78-fix-auto-scroll-losing-bottom-during-rap/) |
| 79 | Sort tray conversations by update time and fix text overflow | 2026-04-07 | e88a491 | [79-sort-menu-conversations-by-update-time-a](./quick/79-sort-menu-conversations-by-update-time-a/) |
| 260417-mg3 | Research sub-agent call identification and display discovery | 2026-04-17 | c3c5dc5 | [260417-mg3-use-research-skill-and-go-through-deeply](./quick/260417-mg3-use-research-skill-and-go-through-deeply/) |
| 260417-nwh | IMPR-1: Emit tool_call:changed event after subagent linking (Needs Review) | 2026-04-17 | 39955d2 | [260417-nwh-impr-1-emit-websocket-tool-call-changed-](./quick/260417-nwh-impr-1-emit-websocket-tool-call-changed-/) |
| 260417-ok0 | IMPR-7: Three-state ghost sub-agent card + subagent_link_attempted column (Needs Review) | 2026-04-17 | 8b362bc | [260417-ok0-impr-7-three-state-ghost-sub-agent-card-](./quick/260417-ok0-impr-7-three-state-ghost-sub-agent-card-/) |
| 260417-phs | IMPR-4: Inline cost and confidence dot on collapsed sub-agent card (Needs Review) | 2026-04-17 | d963dfb | [260417-phs-impr-4-inline-cost-and-confidence-badges](./quick/260417-phs-impr-4-inline-cost-and-confidence-badges/) |
| 260417-phr | IMPR-3: Status-aware timeline icons + pulse during running (Needs Review) | 2026-04-17 | 8b96e70 | [260417-phr-impr-3-status-aware-timeline-icons-and-p](./quick/260417-phr-impr-3-status-aware-timeline-icons-and-p/) |
| 260417-phc | IMPR-2: Sub-agent overview chip strip on ConversationDetailPage (Needs Review) | 2026-04-17 | b32ce7d | [260417-phc-impr-2-sub-agent-overview-chip-strip-at-](./quick/260417-phc-impr-2-sub-agent-overview-chip-strip-at-/) |
| 260417-r5i | IMPR-9: Top sub-agent-heavy conversations Overview widget (Needs Review) | 2026-04-18 | 348a6c3 | [260417-r5i-impr-9-top-sub-agent-heavy-conversations](./quick/260417-r5i-impr-9-top-sub-agent-heavy-conversations/) |
| 260417-r4o | IMPR-6: subagent_fts FTS5 table + ingestion + backfill + search handler (Needs Review) | 2026-04-18 | 8c4e841 | [260417-r4o-impr-6-index-subagent-summary-content-in](./quick/260417-r4o-impr-6-index-subagent-summary-content-in/) |
| 260417-r4p | IMPR-8: Parallel sub-agent visual grouping with shared header (Needs Review) | 2026-04-18 | 3ed26bb | [260417-r4p-impr-8-parallel-sub-agent-visual-groupin](./quick/260417-r4p-impr-8-parallel-sub-agent-visual-groupin/) |
| 260417-r4n | IMPR-5: kind facet (Primary/All/Sub-agents) on ConversationBrowser (Needs Review) | 2026-04-18 | cdea9ba | [260417-r4n-impr-5-sub-agent-only-facet-in-conversat](./quick/260417-r4n-impr-5-sub-agent-only-facet-in-conversat/) |
| 260417-r8b | IMPR-10: Cmd+K palette sub-agent jump (sub N + cross-conversation search) (Needs Review) | 2026-04-18 | 7cd8df7 | [260417-r8b-impr-10-command-palette-cmd-k-for-sub-ag](./quick/260417-r8b-impr-10-command-palette-cmd-k-for-sub-ag/) |
| 260420-n4g | Fix release.sh: staple .app + codesign DMG (eliminates Homebrew xattr workaround) | 2026-04-20 | 21a79c8 | [260420-n4g-diagnose-and-fix-signing-notarization-fa](./quick/260420-n4g-diagnose-and-fix-signing-notarization-fa/) |
| 260420-o2z | Change subagent pills to solid tag style | 2026-04-20 | ebac98e | [260420-o2z-change-subagent-pills-to-solid-tag-style](./quick/260420-o2z-change-subagent-pills-to-solid-tag-style/) |

## Session Continuity

Last session: 2026-04-20
Stopped at: Swapped subagent overview chips to DaisyUI solid badge variants
Resume file: None
