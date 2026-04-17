---
status: complete
quick_id: 260417-r4n
date: 2026-04-18
---

# Quick Task 260417-r4n — IMPR-5: Sub-agent only facet in ConversationBrowser

## What was built

A 3-option `Kind: [Primary | All | Sub-agents]` filter for the conversation browser. Primary is the default and omits the param to preserve back-compat (old clients see no behaviour change).

## Files modified

- `src-tauri/src/conversations.rs` — added optional `kind` field to `ConversationListParams`; branched the parent_conversation_id condition on `kind` (subagent → IS NOT NULL, primary | None | unknown → IS NULL, all → no filter).
- `packages/frontend/src/composables/useConversationBrowser.ts` — added `kind` ref defaulting to `'primary'` and `setKind(k)` setter that resets page=1 and refetches; `kind` value is omitted from URLSearchParams when 'primary' to keep the back-compat contract.
- `packages/frontend/src/components/ConversationBrowser.vue` — 3-option select left of the agent filter.

## Verification

- `cargo check` — 27 pre-existing warnings, zero new
- `vue-tsc --noEmit` — clean
- Back-compat: omitting `kind` returns the same primary-only set as before
- Status: human_needed (visual confirmation of the select + flat sub-agent list pending)

## Execution context

Started as a parallel worktree executor that hit the Anthropic rate limit before producing any output. Recovered by writing the changes manually from the verified plan. See commit `cdea9ba`.

## Deviations from plan

- Children-fetch optimization for `kind=subagent` was not added (the children query runs but returns empty for sub-agent rows — harmless redundancy). Documented as a follow-up.

## Final commit

`cdea9ba` — feat(quick-260417-r4n): kind facet (Primary/All/Sub-agents) on ConversationBrowser
