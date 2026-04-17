---
status: complete
quick_id: 260417-r4o
date: 2026-04-18
---

# Quick Task 260417-r4o — IMPR-6: Index subagent_summary into FTS

## What was built

A new SQLite FTS5 virtual table `subagent_fts` that indexes the synthesised text for every sub-agent tool_call (description, prompt, last_error, files_touched, tool_breakdown keys). The conversation search handler now joins this table so search queries surface parent conversations whose sub-agents matched, even when the parent's own messages don't contain the search term.

## Files modified

- `src-tauri/src/schema.sql` — `CREATE VIRTUAL TABLE IF NOT EXISTS subagent_fts USING fts5(content, tool_call_id UNINDEXED, kind UNINDEXED)`
- `src-tauri/src/db.rs` — idempotent migration probe (`SELECT tool_call_id FROM subagent_fts LIMIT 0` → is_ok()) mirroring the `subagent_link_attempted` pattern
- `src-tauri/src/ingestion/mod.rs` — after each `subagent_summary` UPDATE, transactionally insert/replace the projection in `subagent_fts`. Also adds `subagent_fts_backfilled` to MigrationResult
- `src-tauri/src/ingestion/migration.rs` — new `backfill_subagent_fts` function; marker-guarded via `subagent_fts_backfill_v1` row in `migrations_applied` (mirrors `clear_stale_subagent_links_v1`)
- `src-tauri/src/conversations.rs` — search filter extended with a 5th OR clause that JOINs `tool_calls` to `subagent_fts` and runs FTS5 MATCH against a sanitised prefix-phrase query

## Verification

- `cargo check` — clean (zero new warnings)
- Migration idempotency — probe pattern returns is_ok()=true on existing DBs and skips the CREATE
- Backfill idempotency — DELETE-then-INSERT per tool_call_id; marker row prevents re-runs
- Status: human_needed (visual confirmation of search results pending)

## Execution context

Started as a parallel worktree executor. The executor worked but its commits ended up on main directly (worktree branch never advanced). The executor hit the rate limit mid-Task-3, leaving the backfill code uncommitted in the working tree. Recovered by:
1. Committing the uncommitted backfill (commit `829e66b`)
2. Manually writing the search handler extension (commit `8c4e841`)

## Final commits

- `de27b61` — schema + migration (executor)
- `273dfab` — ingestion wire-up (executor)
- `829e66b` — backfill (manual)
- `8c4e841` — search handler (manual)
