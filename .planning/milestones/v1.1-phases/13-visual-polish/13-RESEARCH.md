# Phase 13: Visual Polish - Research

**Researched:** 2026-03-05
**Domain:** Frontend visual differentiation (icons, color-coded badges)
**Confidence:** HIGH

## Summary

Phase 13 adds visual differentiation to two existing UI elements: (1) tool call type icons in `ToolCallRow.vue` and (2) color-coded model name badges in `AssistantGroupCard.vue` and `TurnCard.vue`. Both are purely frontend changes requiring no backend work, no new API endpoints, and no data model changes.

The project already uses `lucide-vue-next` for icons and DaisyUI 5 with Tailwind CSS 4 for styling. All required Lucide icons exist in the library. The color approach uses Tailwind arbitrary color utilities with opacity modifiers for soft-tint badge backgrounds, matching the existing project pattern of custom badge classes (see `badge-claude` in `app.css`).

**Primary recommendation:** Create two utility modules -- one for tool-type icon/color mapping and one for model name/label/color mapping -- then update the three consuming components. No new dependencies needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Distinct color per model name: each unique model string gets its own color (Opus, Sonnet, Haiku, GPT-4, etc.)
- Soft tint background style: subtle colored background with matching text color (e.g., light purple bg + purple text). Blends with dark theme without being loud
- Short friendly labels: map raw model strings to readable names ("Sonnet 3.5", "Opus", "Haiku", "GPT-4o") instead of showing "claude-3-5-sonnet-20241022"
- No specific color preferences: just make models visually distinct. No requirement to match brand colors
- Distinct color per tool type: each tool type icon gets its own color (not monochrome)
- Icon only colored: the icon gets the type color, tool name text stays neutral base-content for readability
- Icon mapping: Read=file, Bash=terminal, Edit=pencil, Write=file-plus, Grep=search, Glob=folder-search, Agent=bot, WebSearch=globe
- Fallback for unknown tools: keep current Wrench icon with info color

### Claude's Discretion
- Exact color assignments for each model and tool type
- How to implement the model name mapping (utility function vs lookup object)
- Whether to extract the icon/color mapping into a shared utility or keep inline
- Lucide icon choices for any edge cases

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| META-03 | User sees distinct icons per tool call type (Read=file, Bash=terminal, Edit=pencil, Write=file-plus, Grep=search, Glob=folder-search, Agent=bot, WebSearch=globe) | Tool icon/color mapping utility + ToolCallRow.vue dynamic component pattern |
| META-04 | User sees color-coded model name badges in the summary header | Model label/color mapping utility + AssistantGroupCard.vue and TurnCard.vue badge class updates |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lucide-vue-next | latest | SVG icon components | Already used throughout project; all required icons available |
| daisyui | ^5.5.0 | Component classes (badge, etc.) | Already project standard; badge-sm pattern in use |
| tailwindcss | ^4.2.0 | Utility CSS including arbitrary colors | Already project standard; v4 syntax with @import |

### Supporting
No new libraries needed. Everything is achievable with existing dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom CSS badge classes | DaisyUI badge modifiers (badge-primary, badge-secondary) | Only 5-6 semantic colors available, not enough for 8+ distinct models. Custom classes with oklch colors (matching existing badge-claude pattern) provide unlimited distinct colors |
| Tailwind arbitrary classes | CSS custom properties | Arbitrary classes work but generate long class strings. Custom CSS classes in app.css are cleaner and match existing badge-claude pattern |

## Architecture Patterns

### Recommended Utility Structure
```
packages/frontend/src/utils/
  tool-icons.ts          # NEW: tool name -> icon component + color class
  model-labels.ts        # NEW: model string -> short label + badge CSS class
  agent-constants.ts     # EXISTING: agent badge colors (reference pattern)
```

### Pattern 1: Tool Icon Mapping (Lookup Object)
**What:** A record mapping tool call names to their icon component and Tailwind text-color class.
**When to use:** In ToolCallRow.vue to resolve the icon and color from `toolCall.name`.
**Example:**
```typescript
// Source: project convention (agent-constants.ts pattern)
import {
  FileText, Terminal, Pencil, FilePlus, Search,
  FolderSearch, Bot, Globe, Wrench,
} from 'lucide-vue-next';
import type { Component } from 'vue';

export interface ToolIconInfo {
  icon: Component;
  colorClass: string;
}

const TOOL_ICONS: Record<string, ToolIconInfo> = {
  Read:      { icon: FileText,     colorClass: 'text-sky-400' },
  Bash:      { icon: Terminal,     colorClass: 'text-emerald-400' },
  Edit:      { icon: Pencil,       colorClass: 'text-amber-400' },
  Write:     { icon: FilePlus,     colorClass: 'text-teal-400' },
  Grep:      { icon: Search,       colorClass: 'text-violet-400' },
  Glob:      { icon: FolderSearch,  colorClass: 'text-rose-400' },
  Agent:     { icon: Bot,          colorClass: 'text-fuchsia-400' },
  WebSearch: { icon: Globe,        colorClass: 'text-cyan-400' },
};

const FALLBACK: ToolIconInfo = { icon: Wrench, colorClass: 'text-info' };

export function getToolIcon(toolName: string): ToolIconInfo {
  return TOOL_ICONS[toolName] ?? FALLBACK;
}
```

### Pattern 2: Model Label + Badge Class Mapping
**What:** A function that maps raw model ID strings (e.g. "claude-3-5-sonnet-20241022") to a short label and CSS class for the badge.
**When to use:** In AssistantGroupCard.vue and TurnCard.vue to display model badges.
**Example:**
```typescript
// Source: project convention (agent-constants.ts + badge-claude in app.css)
export interface ModelBadgeInfo {
  label: string;
  cssClass: string;
}

// Ordered matchers: first match wins
const MODEL_MATCHERS: Array<{ pattern: string; info: ModelBadgeInfo }> = [
  { pattern: 'opus',      info: { label: 'Opus',       cssClass: 'badge-model-opus' } },
  { pattern: 'sonnet',    info: { label: 'Sonnet',     cssClass: 'badge-model-sonnet' } },
  { pattern: 'haiku',     info: { label: 'Haiku',      cssClass: 'badge-model-haiku' } },
  { pattern: 'gpt-4o',    info: { label: 'GPT-4o',     cssClass: 'badge-model-gpt4o' } },
  { pattern: 'gpt-4',     info: { label: 'GPT-4',      cssClass: 'badge-model-gpt4' } },
  { pattern: 'gpt-3',     info: { label: 'GPT-3.5',    cssClass: 'badge-model-gpt35' } },
  { pattern: 'o1',        info: { label: 'o1',          cssClass: 'badge-model-o1' } },
  { pattern: 'o3',        info: { label: 'o3',          cssClass: 'badge-model-o3' } },
  { pattern: 'gemini',    info: { label: 'Gemini',     cssClass: 'badge-model-gemini' } },
  { pattern: 'deepseek',  info: { label: 'DeepSeek',   cssClass: 'badge-model-deepseek' } },
];

const FALLBACK: ModelBadgeInfo = { label: '', cssClass: 'badge-ghost' };

export function getModelBadge(modelString: string | null): ModelBadgeInfo {
  if (!modelString) return FALLBACK;
  const lower = modelString.toLowerCase();
  for (const { pattern, info } of MODEL_MATCHERS) {
    if (lower.includes(pattern)) return { ...info };
  }
  // Unknown model: use raw string with ghost styling
  return { label: modelString, cssClass: 'badge-ghost' };
}
```

### Pattern 3: Custom Badge CSS Classes in app.css
**What:** Define model badge classes using oklch colors in app.css, matching the existing `badge-claude` pattern.
**When to use:** For model-specific badge coloring that works consistently with the forest dark theme.
**Example:**
```css
/* app.css additions - soft tint badges for model names */
.badge-model-opus    { background-color: oklch(0.35 0.12 280); color: oklch(0.80 0.12 280); }
.badge-model-sonnet  { background-color: oklch(0.35 0.12 320); color: oklch(0.80 0.12 320); }
.badge-model-haiku   { background-color: oklch(0.35 0.12 160); color: oklch(0.80 0.12 160); }
.badge-model-gpt4o   { background-color: oklch(0.35 0.12 145); color: oklch(0.80 0.12 145); }
.badge-model-gpt4    { background-color: oklch(0.35 0.12 145); color: oklch(0.80 0.12 145); }
.badge-model-gpt35   { background-color: oklch(0.35 0.10 200); color: oklch(0.80 0.10 200); }
.badge-model-o1      { background-color: oklch(0.35 0.12 80);  color: oklch(0.80 0.12 80); }
.badge-model-o3      { background-color: oklch(0.35 0.12 55);  color: oklch(0.80 0.12 55); }
.badge-model-gemini  { background-color: oklch(0.35 0.12 250); color: oklch(0.80 0.12 250); }
.badge-model-deepseek { background-color: oklch(0.35 0.12 220); color: oklch(0.80 0.12 220); }
```

### Pattern 4: Vue Dynamic Component for Icons
**What:** Use Vue's `:is` binding or `<component :is="...">` to render the correct Lucide icon dynamically.
**When to use:** In ToolCallRow.vue template.
**Example:**
```vue
<template>
  <component :is="toolIcon.icon" class="w-3.5 h-3.5 shrink-0" :class="toolIcon.colorClass" />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getToolIcon } from '../utils/tool-icons';

const toolIcon = computed(() => getToolIcon(props.toolCall.name));
</script>
```

### Anti-Patterns to Avoid
- **Inline switch/if-else in templates:** Don't put icon selection logic in the template. Extract to a utility function for testability and reuse.
- **String interpolation for class names with Tailwind:** Don't use `text-${color}-400` dynamic interpolation. Tailwind/DaisyUI purges unused classes at build time, so dynamic class construction breaks. Use full class strings from a lookup.
- **Hard-coding model strings:** Don't match exact model IDs like "claude-3-5-sonnet-20241022". Use substring matching (`.includes('sonnet')`) to handle version suffixes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG icons | Custom SVG paths | lucide-vue-next components | Already installed; consistent sizing, tree-shakeable |
| Badge component | Custom badge element | DaisyUI `badge badge-sm` + custom color classes | Matches existing project patterns exactly |
| Dark theme color adaptation | Manual dark: prefixes | oklch color system in app.css | oklch works across themes; existing badge-claude proves the pattern |

## Common Pitfalls

### Pitfall 1: Tailwind CSS Purging Dynamic Classes
**What goes wrong:** Using string interpolation like `` `text-${color}-400` `` produces class names Tailwind never sees during build, so the CSS is not generated.
**Why it happens:** Tailwind v4 scans source files for complete class strings. Dynamically constructed strings are invisible to the scanner.
**How to avoid:** Always use complete, literal class strings in lookup objects. The `TOOL_ICONS` record above has full `'text-sky-400'` strings, never interpolated.
**Warning signs:** Icons render but have no color (fallback to inherited text color).

### Pitfall 2: Model String Matching Order
**What goes wrong:** Matching "gpt-4" before "gpt-4o" means GPT-4o models get the GPT-4 label.
**Why it happens:** Substring matching with `.includes()` is order-dependent.
**How to avoid:** Order matchers from most specific to least specific. Put "gpt-4o" before "gpt-4" in the matcher array.
**Warning signs:** All GPT-4 variants showing the same label.

### Pitfall 3: Missing Lucide Icon Import Causes Build Error
**What goes wrong:** Importing a non-existent icon name from lucide-vue-next causes a Vite build failure.
**Why it happens:** Lucide uses named exports; typos or wrong icon names fail at import time.
**How to avoid:** Verify exact icon names from Lucide docs. The correct names are: `FileText`, `Terminal`, `Pencil`, `FilePlus`, `Search`, `FolderSearch`, `Bot`, `Globe`, `Wrench`.
**Warning signs:** TypeScript/ESLint error on import line.

### Pitfall 4: Forgetting TurnCard.vue
**What goes wrong:** Model badge is updated in AssistantGroupCard.vue but not in TurnCard.vue, creating inconsistent styling.
**Why it happens:** Both components have model badges (line 15-17 in each). The CONTEXT.md only mentions AssistantGroupCard explicitly.
**How to avoid:** Update both components. They both have `badge badge-sm badge-ghost` for model display.
**Warning signs:** Model badges look different in grouped vs. ungrouped conversation views.

## Code Examples

### ToolCallRow.vue Changes (META-03)
```vue
<!-- Before -->
<Wrench class="w-3.5 h-3.5 text-info shrink-0" />

<!-- After -->
<component :is="toolIcon.icon" class="w-3.5 h-3.5 shrink-0" :class="toolIcon.colorClass" />
```

Script changes:
```typescript
// Before
import { Wrench, Copy, Check } from 'lucide-vue-next';

// After
import { Copy, Check } from 'lucide-vue-next';
import { getToolIcon } from '../utils/tool-icons';

const toolIcon = computed(() => getToolIcon(props.toolCall.name));
```

### AssistantGroupCard.vue Changes (META-04)
```vue
<!-- Before (line 14-16) -->
<span v-if="group.model" class="badge badge-sm badge-ghost">
  {{ group.model }}
</span>

<!-- After -->
<span v-if="group.model" class="badge badge-sm" :class="modelBadge.cssClass">
  {{ modelBadge.label }}
</span>
```

Script changes:
```typescript
import { getModelBadge } from '../utils/model-labels';

const modelBadge = computed(() => getModelBadge(props.group.model));
```

### TurnCard.vue Changes (META-04)
```vue
<!-- Before (line 14-17) -->
<span v-if="turn.message.model" class="badge badge-sm badge-ghost">
  {{ turn.message.model }}
</span>

<!-- After -->
<span v-if="turn.message.model" class="badge badge-sm" :class="modelBadge.cssClass">
  {{ modelBadge.label }}
</span>
```

Script changes:
```typescript
import { getModelBadge } from '../utils/model-labels';

const modelBadge = computed(() => getModelBadge(props.turn.message.model));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 config-based theme colors | Tailwind v4 CSS-first with @plugin | Tailwind v4 (2024) | Use @import "tailwindcss" + @plugin "daisyui" syntax (already in project app.css) |
| DaisyUI v4 require() plugin | DaisyUI v5 @plugin directive | DaisyUI 5 (2025) | Theme declared in CSS not JS config (already in project app.css) |

## Open Questions

1. **What tool call names appear in real data?**
   - What we know: The icon mapping covers Read, Bash, Edit, Write, Grep, Glob, Agent, WebSearch, plus Wrench fallback
   - What's unclear: Are there other tool names in the database (e.g., "TodoWrite", "WebFetch", "TaskOutput") that should get specific icons?
   - Recommendation: The Wrench fallback handles unknowns gracefully. Can add more mappings later as needed without breaking anything.

2. **What model strings appear in real data?**
   - What we know: Claude models (opus, sonnet, haiku variants), possibly GPT models from Cursor
   - What's unclear: Exact model ID format stored in the database
   - Recommendation: Substring matching handles version suffixes and date suffixes naturally. The fallback shows the raw model string with ghost styling.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | packages/frontend/vitest.config.ts |
| Quick run command | `cd packages/frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd packages/frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| META-03 | getToolIcon returns correct icon+color for each tool name | unit | `cd packages/frontend && npx vitest run tests/utils/tool-icons.test.ts -x` | Wave 0 |
| META-03 | getToolIcon returns Wrench fallback for unknown tools | unit | `cd packages/frontend && npx vitest run tests/utils/tool-icons.test.ts -x` | Wave 0 |
| META-04 | getModelBadge returns correct label+class for known models | unit | `cd packages/frontend && npx vitest run tests/utils/model-labels.test.ts -x` | Wave 0 |
| META-04 | getModelBadge handles null/unknown model strings gracefully | unit | `cd packages/frontend && npx vitest run tests/utils/model-labels.test.ts -x` | Wave 0 |
| META-04 | Model matching is order-independent for overlapping names | unit | `cd packages/frontend && npx vitest run tests/utils/model-labels.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd packages/frontend && npx vitest run`
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] `packages/frontend/tests/utils/tool-icons.test.ts` -- covers META-03 (tool icon lookup)
- [ ] `packages/frontend/tests/utils/model-labels.test.ts` -- covers META-04 (model label/badge lookup)

## Sources

### Primary (HIGH confidence)
- Project source code: `ToolCallRow.vue`, `AssistantGroupCard.vue`, `TurnCard.vue`, `AgentBadge.vue`, `app.css`, `agent-constants.ts` -- read directly
- Project `package.json` -- confirmed lucide-vue-next, daisyui ^5.5.0, tailwindcss ^4.2.0
- DaisyUI skill docs -- badge component classes, theming system

### Secondary (MEDIUM confidence)
- Lucide icon names (FileText, Terminal, Pencil, FilePlus, Search, FolderSearch, Bot, Globe) -- from lucide.dev, confirmed available in lucide-vue-next

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and in use
- Architecture: HIGH - follows existing project patterns (agent-constants.ts, badge-claude)
- Pitfalls: HIGH - well-understood Vue/Tailwind patterns with known gotchas

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- no moving parts, all deps already locked)
