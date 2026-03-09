---
phase: 27-tool-viewers
plan: 02
subsystem: ui
tags: [vue, diff-viewer, code-viewer, bash-viewer, tool-dispatch, daisyui]

# Dependency graph
requires:
  - phase: 27-tool-viewers
    provides: "LCS diff algorithm (computeLineDiff) and file-language mapper (getLanguageFromPath)"
provides:
  - "DiffViewer for Edit tool calls with line-level red/green diff display"
  - "CodeViewer for Read/Write tool calls with syntax highlighting"
  - "BashViewer for Bash tool calls with terminal-styled command display"
  - "JsonFallbackViewer for unknown tool types with formatted JSON"
  - "Tool-specific dispatcher in ToolCallRow.vue"
affects: [tool-viewers]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Component dispatcher pattern routing tool types to specialized viewers", "Guard-and-fallback pattern for malformed tool inputs"]

key-files:
  created:
    - packages/frontend/src/components/tool-viewers/DiffViewer.vue
    - packages/frontend/src/components/tool-viewers/CodeViewer.vue
    - packages/frontend/src/components/tool-viewers/BashViewer.vue
    - packages/frontend/src/components/tool-viewers/JsonFallbackViewer.vue
  modified:
    - packages/frontend/src/components/ToolCallRow.vue

key-decisions:
  - "Each viewer guards its own input and falls back to JsonFallbackViewer for malformed data"
  - "CodeViewer reuses existing CodeBlock component for syntax highlighting with line numbers"
  - "BashViewer uses neutral bg-base-300 for all output (simpler than heuristic error detection)"
  - "ToolCallRow reduced from 151 to 48 lines by moving all display logic to viewer components"

patterns-established:
  - "Tool viewer dispatch: v-if chain on toolCall.name routes to specialized viewer components"
  - "Guard-and-fallback: each viewer validates input shape and renders JsonFallbackViewer for invalid data"

requirements-completed: [TOOL-01, TOOL-02, TOOL-03, TOOL-04]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 27 Plan 02: Tool Viewer Components Summary

**Four purpose-built Vue viewer components (Diff, Code, Bash, JSON) with dispatcher routing in ToolCallRow**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T08:33:45Z
- **Completed:** 2026-03-09T08:35:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- DiffViewer displays line-level diffs with red/green highlighting, dual line-number gutters, and +N/-M stat badges
- CodeViewer renders syntax-highlighted code using existing CodeBlock component with language badge from file extension
- BashViewer shows terminal-styled command block with green $ prompt and truncatable output
- JsonFallbackViewer provides formatted JSON with copy buttons for unknown tool types
- ToolCallRow simplified from 151 to 48 lines via component dispatcher pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Create four tool viewer components** - `671e387` (feat)
2. **Task 2: Wire dispatcher into ToolCallRow.vue** - `087f776` (feat)

## Files Created/Modified
- `packages/frontend/src/components/tool-viewers/DiffViewer.vue` - Edit tool diff display with LCS algorithm, line gutters, +N/-M badges
- `packages/frontend/src/components/tool-viewers/CodeViewer.vue` - Read/Write code display using CodeBlock with language detection
- `packages/frontend/src/components/tool-viewers/BashViewer.vue` - Bash command terminal display with $ prompt and output truncation
- `packages/frontend/src/components/tool-viewers/JsonFallbackViewer.vue` - Default JSON display with copy buttons for unknown tools
- `packages/frontend/src/components/ToolCallRow.vue` - Simplified to header row + viewer dispatcher

## Decisions Made
- Each viewer guards its own input shape and falls back to JsonFallbackViewer for malformed/null data
- CodeViewer reuses existing CodeBlock component rather than duplicating syntax highlighting logic
- BashViewer uses neutral bg-base-300 for all output instead of heuristic error detection (simpler, more reliable)
- ToolCallRow reduced from 151 to 48 lines by extracting all display logic to individual viewer components

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 27 (Tool Viewers) fully complete -- both utility and component plans delivered
- All four tool types (Edit, Read/Write, Bash, unknown) have purpose-built viewers
- Malformed inputs gracefully handled via guard-and-fallback pattern

---
*Phase: 27-tool-viewers*
*Completed: 2026-03-09*
