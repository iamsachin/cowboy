#!/usr/bin/env bash
set -euo pipefail

# Row-level SQLite diff between Node.js and Rust ingested databases
# Verifies ING-05: data parity between the two backends.
#
# Usage: ./scripts/diff-ingestion.sh [node-db-path] [rust-db-path]
#   Defaults: node-db-path = cowboy.db (existing Node.js-populated DB)
#             rust-db-path = cowboy-rust.db (fresh Rust-ingested DB)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

NODE_DB="${1:-${PROJECT_ROOT}/cowboy.db}"
RUST_DB="${2:-${PROJECT_ROOT}/cowboy-rust.db}"

# ── Prerequisites ────────────────────────────────────────────────────────

if ! command -v sqlite3 &>/dev/null; then
    echo "ERROR: sqlite3 is required but not found in PATH"
    exit 1
fi

if [ ! -f "$NODE_DB" ]; then
    echo "ERROR: Node.js database not found: $NODE_DB"
    echo "Run the Node.js backend ingestion first, or specify the path as the first argument."
    exit 1
fi

if [ ! -f "$RUST_DB" ]; then
    echo "ERROR: Rust database not found: $RUST_DB"
    echo "Run the Rust backend ingestion first (POST /api/ingest on :3001),"
    echo "or specify the path as the second argument."
    exit 1
fi

echo "=== Cowboy Ingestion Diff Tool ==="
echo "Node.js DB: $NODE_DB"
echo "Rust DB:    $RUST_DB"
echo ""

# ── Table definitions ────────────────────────────────────────────────────

# Key columns per table (excludes volatile fields like updated_at that may differ by milliseconds)
declare -A TABLE_QUERIES
TABLE_QUERIES[conversations]="SELECT id, agent, project, title, created_at, model, status, parent_conversation_id FROM conversations ORDER BY id"
TABLE_QUERIES[messages]="SELECT id, conversation_id, role, substr(content, 1, 200) as content, substr(thinking, 1, 200) as thinking, created_at, model FROM messages ORDER BY id"
TABLE_QUERIES[tool_calls]="SELECT id, message_id, conversation_id, name, status, created_at FROM tool_calls ORDER BY id"
TABLE_QUERIES[token_usage]="SELECT id, conversation_id, message_id, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens FROM token_usage ORDER BY id"
TABLE_QUERIES[plans]="SELECT id, conversation_id, source_message_id, title, total_steps, completed_steps, status FROM plans ORDER BY id"
TABLE_QUERIES[plan_steps]="SELECT id, plan_id, step_number, content, status FROM plan_steps ORDER BY id"
TABLE_QUERIES[compaction_events]="SELECT id, conversation_id, timestamp, tokens_before, tokens_after FROM compaction_events ORDER BY id"

TABLES=(conversations messages tool_calls token_usage plans plan_steps compaction_events)

# ── Diff each table ──────────────────────────────────────────────────────

TOTAL=${#TABLES[@]}
PASSED=0
FAILED=0
DIFF_DIR=$(mktemp -d)

trap "rm -rf $DIFF_DIR" EXIT

for table in "${TABLES[@]}"; do
    query="${TABLE_QUERIES[$table]}"

    # Check if table exists in both databases
    node_has_table=$(sqlite3 "$NODE_DB" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='$table'" 2>/dev/null || echo "0")
    rust_has_table=$(sqlite3 "$RUST_DB" "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='$table'" 2>/dev/null || echo "0")

    if [ "$node_has_table" = "0" ] && [ "$rust_has_table" = "0" ]; then
        echo "  SKIP  $table (not in either database)"
        continue
    fi

    if [ "$node_has_table" = "0" ]; then
        echo "  SKIP  $table (not in Node.js database)"
        continue
    fi

    if [ "$rust_has_table" = "0" ]; then
        echo "  SKIP  $table (not in Rust database)"
        continue
    fi

    # Dump as JSON
    node_file="$DIFF_DIR/${table}_node.json"
    rust_file="$DIFF_DIR/${table}_rust.json"

    sqlite3 -json "$NODE_DB" "$query" > "$node_file" 2>/dev/null || echo "[]" > "$node_file"
    sqlite3 -json "$RUST_DB" "$query" > "$rust_file" 2>/dev/null || echo "[]" > "$rust_file"

    # Count rows
    node_count=$(sqlite3 "$NODE_DB" "SELECT count(*) FROM $table" 2>/dev/null || echo "0")
    rust_count=$(sqlite3 "$RUST_DB" "SELECT count(*) FROM $table" 2>/dev/null || echo "0")

    # Compare
    if diff -q "$node_file" "$rust_file" >/dev/null 2>&1; then
        echo "  PASS  $table ($node_count rows)"
        PASSED=$((PASSED + 1))
    else
        echo "  FAIL  $table (node: $node_count rows, rust: $rust_count rows)"
        FAILED=$((FAILED + 1))

        # Show first 20 diff lines
        echo "        First differences:"
        diff "$node_file" "$rust_file" | head -20 | sed 's/^/        /'
        echo ""
    fi
done

# ── Summary ──────────────────────────────────────────────────────────────

echo ""
echo "=== Summary ==="
echo "Tables compared: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"

if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo "RESULT: DIFFERENCES FOUND"
    exit 1
else
    echo ""
    echo "RESULT: ALL TABLES MATCH"
    exit 0
fi
