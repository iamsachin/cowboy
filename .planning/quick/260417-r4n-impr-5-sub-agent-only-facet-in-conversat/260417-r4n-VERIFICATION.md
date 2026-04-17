---
status: human_needed
quick_id: 260417-r4n
date: 2026-04-18
---

# Verification — IMPR-5

## Static verification

| Must-have | Status |
|-----------|--------|
| Backend `kind` param accepted on list endpoint | VERIFIED — `conversations.rs` ConversationListParams |
| Primary maps to `IS NULL`; subagent maps to `IS NOT NULL`; all skips the filter | VERIFIED — match arm in conversation_list closure |
| Back-compat: omitting `kind` returns primary-only | VERIFIED — `Some("primary") | None | Some(_)` arm |
| Frontend default = `'primary'` (omits the param) | VERIFIED — composable ref initialiser |
| `setKind(k)` resets page and refetches | VERIFIED — composable function |
| 3-option `<select>` rendered above the table | VERIFIED — ConversationBrowser.vue |
| `vue-tsc --noEmit` clean | VERIFIED |
| `cargo check` clean (27 pre-existing warnings, zero new) | VERIFIED |

## Human smoke tests pending

1. Visual placement of the `Kind` select in the filter bar
2. Switching to `Sub-agents` returns a flat paged list (no parent grouping)
3. Switching back to `Primary` returns to today's view
4. Pagination resets when changing kind
