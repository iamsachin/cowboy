---
status: human_needed
quick_id: 260417-r4o
date: 2026-04-18
---

# Verification — IMPR-6

## Static verification

| Must-have | Status |
|-----------|--------|
| `subagent_fts` virtual table defined in schema.sql | VERIFIED |
| Idempotent migration in db.rs (probe pattern) | VERIFIED |
| Ingestion writes to subagent_fts after each summary UPDATE | VERIFIED — `ingestion/mod.rs` transactional block |
| One-off backfill function with marker row | VERIFIED — `migration.rs::backfill_subagent_fts` |
| Backfill marker name `subagent_fts_backfill_v1` | VERIFIED |
| Search handler extended with FTS JOIN clause | VERIFIED — `conversations.rs` search filter |
| FTS5 prefix-phrase query format `"term"*` with quote stripping | VERIFIED |
| `cargo check` clean | VERIFIED |

## Human smoke tests pending

1. Searching for a word only in a sub-agent's description finds the parent conversation
2. Searching for a `lastError` substring finds the parent
3. Migration runs cleanly on an existing DB (no errors, no duplicate rows)
4. Re-running the app does not re-trigger the backfill (marker row honored)
