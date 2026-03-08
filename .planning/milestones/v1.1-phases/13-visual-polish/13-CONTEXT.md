# Phase 13: Visual Polish - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Tool calls and model names are visually differentiated with icons and color coding for quick scanning. Each tool call row gets a type-specific icon, and model name badges in summary headers get per-model color coding.

Scope: META-03 (tool call type icons) and META-04 (color-coded model badges). No new features, no layout changes, no interaction changes.

</domain>

<decisions>
## Implementation Decisions

### Model badge colors
- Distinct color per model name: each unique model string gets its own color (Opus, Sonnet, Haiku, GPT-4, etc.)
- Soft tint background style: subtle colored background with matching text color (e.g., light purple bg + purple text). Blends with dark theme without being loud
- Short friendly labels: map raw model strings to readable names ("Sonnet 3.5", "Opus", "Haiku", "GPT-4o") instead of showing "claude-3-5-sonnet-20241022"
- No specific color preferences: just make models visually distinct. No requirement to match brand colors

### Tool call type icons
- Distinct color per tool type: each tool type icon gets its own color (not monochrome)
- Icon only colored: the icon gets the type color, tool name text stays neutral base-content for readability
- Icon mapping (from success criteria): Read=file, Bash=terminal, Edit=pencil, Write=file-plus, Grep=search, Glob=folder-search, Agent=bot, WebSearch=globe
- Fallback for unknown tools: keep current Wrench icon with info color. Consistent with existing behavior

### Claude's Discretion
- Exact color assignments for each model and tool type
- How to implement the model name mapping (utility function vs lookup object)
- Whether to extract the icon/color mapping into a shared utility or keep inline
- Lucide icon choices for any edge cases

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: the current `ToolCallRow.vue` uses a single Wrench icon for all tools (line 5), and `AssistantGroupCard.vue` uses `badge-ghost` for model badges (line 15-16). Both need to become dynamic.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ToolCallRow.vue`: Currently uses `Wrench` icon for all tool calls — replace with dynamic icon based on `toolCall.name`
- `AssistantGroupCard.vue`: Currently uses `badge-ghost` for model badge — replace with dynamic color class based on `group.model`
- `AgentBadge.vue`: Existing pattern for color-per-entity badges (badge-claude, badge-secondary) — follow same approach
- Lucide icons already imported: Brain, Wrench, ChevronDown, Copy, Check — add FileText, Terminal, Pencil, FilePlus, Search, FolderSearch, Bot, Globe

### Established Patterns
- DaisyUI 5 badge classes for colored badges (badge-sm, badge-ghost, badge-success, badge-warning)
- Lucide-vue-next for all icons (w-3.5 h-3.5 sizing in ToolCallRow, w-4 h-4 in headers)
- Computed properties for dynamic styling in Vue components

### Integration Points
- `ToolCallRow.vue` line 5: Replace `<Wrench>` with dynamic icon component
- `AssistantGroupCard.vue` line 15-16: Replace `badge-ghost` with dynamic color class
- May need a shared utility for model name → short label + color class mapping
- May need a shared utility for tool name → icon component + color class mapping

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-visual-polish*
*Context gathered: 2026-03-05*
