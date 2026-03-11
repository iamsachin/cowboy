#!/bin/bash
# scripts/diff-backends.sh
# Compare Node.js (:3000) vs Rust (:3001) API responses
# Primary validation artifact for Phase 37+38: zero differences on all endpoints
#
# Usage:
#   ./scripts/diff-backends.sh              # Read tests only (backward compatible)
#   ./scripts/diff-backends.sh --read       # Explicit read-only tests
#   ./scripts/diff-backends.sh --write      # Mutation tests only
#   ./scripts/diff-backends.sh --all        # Both read + write tests
#   ./scripts/diff-backends.sh --endpoint plans/stats  # Test single endpoint

set -uo pipefail

BASE_NODE="http://127.0.0.1:3000/api"
BASE_RUST="http://127.0.0.1:3001/api"
DATE_FROM="2026-01-01"
DATE_TO="2026-03-11"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
SKIP=0
SINGLE_ENDPOINT=""
RUN_READ=false
RUN_WRITE=false

# Parse args
if [[ $# -eq 0 ]]; then
  RUN_READ=true
fi

while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      RUN_READ=true
      RUN_WRITE=true
      shift
      ;;
    --read)
      RUN_READ=true
      shift
      ;;
    --write)
      RUN_WRITE=true
      shift
      ;;
    --endpoint)
      SINGLE_ENDPOINT="$2"
      RUN_READ=true
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--all | --read | --write | --endpoint NAME]"
      exit 1
      ;;
  esac
done

# Normalize JSON: sort keys and round all numbers to 3 decimal places for float tolerance
normalize() {
  jq -S 'walk(if type == "number" then (. * 1000 | round / 1000) else . end)' 2>/dev/null || echo "INVALID_JSON"
}

compare_endpoint() {
  local endpoint="$1"
  local label="${2:-$endpoint}"

  local node_raw rust_raw node_out rust_out

  node_raw=$(curl -sf "$BASE_NODE/$endpoint" 2>/dev/null) || node_raw=""
  rust_raw=$(curl -sf "$BASE_RUST/$endpoint" 2>/dev/null) || rust_raw=""

  if [ -z "$node_raw" ]; then
    echo -e "${YELLOW}SKIP${NC}: $label (Node.js returned empty/error)"
    SKIP=$((SKIP + 1))
    return
  fi

  if [ -z "$rust_raw" ]; then
    echo -e "${RED}FAIL${NC}: $label (Rust returned empty/error)"
    FAIL=$((FAIL + 1))
    return
  fi

  node_out=$(echo "$node_raw" | normalize)
  rust_out=$(echo "$rust_raw" | normalize)

  if [ "$node_out" = "$rust_out" ]; then
    echo -e "${GREEN}PASS${NC}: $label"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}: $label"
    diff --color=auto <(echo "$node_out") <(echo "$rust_out") | head -30
    echo "..."
    FAIL=$((FAIL + 1))
  fi
}

# Compare a mutation: PUT on both, then GET and diff results, then cleanup
compare_mutation() {
  local put_endpoint="$1"
  local get_endpoint="$2"
  local label="$3"
  local body="$4"

  # PUT on both backends
  local node_put rust_put
  node_put=$(curl -sf -X PUT -H 'Content-Type: application/json' -d "$body" "$BASE_NODE/$put_endpoint" 2>/dev/null) || node_put=""
  rust_put=$(curl -sf -X PUT -H 'Content-Type: application/json' -d "$body" "$BASE_RUST/$put_endpoint" 2>/dev/null) || rust_put=""

  if [ -z "$node_put" ]; then
    echo -e "${YELLOW}SKIP${NC}: $label PUT (Node.js returned empty/error)"
    SKIP=$((SKIP + 1))
    return
  fi

  if [ -z "$rust_put" ]; then
    echo -e "${RED}FAIL${NC}: $label PUT (Rust returned empty/error)"
    FAIL=$((FAIL + 1))
    return
  fi

  # Compare PUT responses
  local node_out rust_out
  node_out=$(echo "$node_put" | normalize)
  rust_out=$(echo "$rust_put" | normalize)

  if [ "$node_out" = "$rust_out" ]; then
    echo -e "${GREEN}PASS${NC}: $label (PUT response)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}: $label (PUT response)"
    diff --color=auto <(echo "$node_out") <(echo "$rust_out") | head -30
    echo "..."
    FAIL=$((FAIL + 1))
  fi

  # GET and diff
  compare_endpoint "$get_endpoint" "$label (GET after PUT)"
}

# ── Static Endpoints ────────────────────────────────────────────────

STATIC_ENDPOINTS=(
  "analytics/overview?from=${DATE_FROM}&to=${DATE_TO}"
  "analytics/timeseries?from=${DATE_FROM}&to=${DATE_TO}&granularity=weekly"
  "analytics/model-distribution?from=${DATE_FROM}&to=${DATE_TO}"
  "analytics/tool-stats?from=${DATE_FROM}&to=${DATE_TO}"
  "analytics/heatmap?from=${DATE_FROM}&to=${DATE_TO}"
  "analytics/project-stats?from=${DATE_FROM}&to=${DATE_TO}"
  "analytics/token-rate"
  "analytics/filters?from=${DATE_FROM}&to=${DATE_TO}"
  "analytics/conversations?from=${DATE_FROM}&to=${DATE_TO}&page=1&limit=5"
  "plans?from=${DATE_FROM}&to=${DATE_TO}&page=1&limit=5"
  "plans/stats?from=${DATE_FROM}&to=${DATE_TO}"
  "plans/timeseries?from=${DATE_FROM}&to=${DATE_TO}&granularity=weekly"
  "settings"
  "settings/db-stats"
)

echo "================================================"
echo " Cowboy Backend Diff: Node.js vs Rust"
echo " Node: $BASE_NODE"
echo " Rust: $BASE_RUST"
echo "================================================"
echo ""

if [ -n "$SINGLE_ENDPOINT" ]; then
  compare_endpoint "$SINGLE_ENDPOINT"
fi

# ── Read Tests ──────────────────────────────────────────────────────

if $RUN_READ && [ -z "$SINGLE_ENDPOINT" ]; then
  echo "--- Read Endpoints ---"
  echo ""

  for endpoint in "${STATIC_ENDPOINTS[@]}"; do
    compare_endpoint "$endpoint"
  done

  echo ""
  echo "--- Dynamic Endpoints ---"
  echo ""

  # Get first conversation ID
  CONV_ID=$(curl -sf "$BASE_NODE/analytics/conversations?from=${DATE_FROM}&to=${DATE_TO}&page=1&limit=1" 2>/dev/null | jq -r '.rows[0].id // empty' 2>/dev/null || echo "")

  if [ -n "$CONV_ID" ]; then
    compare_endpoint "analytics/conversations/$CONV_ID" "analytics/conversations/:id ($CONV_ID)"
    compare_endpoint "plans/by-conversation/$CONV_ID" "plans/by-conversation/:conversationId ($CONV_ID)"
  else
    echo -e "${YELLOW}SKIP${NC}: analytics/conversations/:id (no conversation found)"
    echo -e "${YELLOW}SKIP${NC}: plans/by-conversation/:conversationId (no conversation found)"
    SKIP=$((SKIP + 2))
  fi

  # Get first plan ID
  PLAN_ID=$(curl -sf "$BASE_NODE/plans?from=${DATE_FROM}&to=${DATE_TO}&page=1&limit=1" 2>/dev/null | jq -r '.rows[0].id // empty' 2>/dev/null || echo "")

  if [ -n "$PLAN_ID" ]; then
    compare_endpoint "plans/$PLAN_ID" "plans/:id ($PLAN_ID)"
  else
    echo -e "${YELLOW}SKIP${NC}: plans/:id (no plan found)"
    SKIP=$((SKIP + 1))
  fi
fi

# ── Write Tests ─────────────────────────────────────────────────────

if $RUN_WRITE; then
  echo ""
  echo "--- Write (Mutation) Tests ---"
  echo ""

  # Save current settings from both backends for restoration
  SETTINGS_BACKUP_NODE=$(curl -sf "$BASE_NODE/settings" 2>/dev/null) || SETTINGS_BACKUP_NODE=""
  SETTINGS_BACKUP_RUST=$(curl -sf "$BASE_RUST/settings" 2>/dev/null) || SETTINGS_BACKUP_RUST=""

  if [ -z "$SETTINGS_BACKUP_NODE" ] || [ -z "$SETTINGS_BACKUP_RUST" ]; then
    echo -e "${YELLOW}SKIP${NC}: Write tests (could not read current settings for backup)"
    SKIP=$((SKIP + 1))
  else
    # Test 1: PUT /settings/agent
    AGENT_BODY='{"claudeCodePath":"/tmp/test-cowboy-path","claudeCodeEnabled":true,"cursorPath":"/tmp/test-cursor-path","cursorEnabled":false}'
    compare_mutation "settings/agent" "settings" "PUT /settings/agent" "$AGENT_BODY"

    # Test 2: PUT /settings/sync
    SYNC_BODY='{"syncEnabled":true,"syncUrl":"http://test.example.com","syncFrequency":600,"syncCategories":["conversations"]}'
    compare_mutation "settings/sync" "settings" "PUT /settings/sync" "$SYNC_BODY"

    # Test 3: POST /settings/validate-path (with a known-good path)
    VALIDATE_BODY="{\"path\":\"$HOME\",\"agent\":\"claude-code\"}"
    node_validate=$(curl -sf -X POST -H 'Content-Type: application/json' -d "$VALIDATE_BODY" "$BASE_NODE/settings/validate-path" 2>/dev/null) || node_validate=""
    rust_validate=$(curl -sf -X POST -H 'Content-Type: application/json' -d "$VALIDATE_BODY" "$BASE_RUST/settings/validate-path" 2>/dev/null) || rust_validate=""

    if [ -n "$node_validate" ] && [ -n "$rust_validate" ]; then
      nv=$(echo "$node_validate" | normalize)
      rv=$(echo "$rust_validate" | normalize)
      if [ "$nv" = "$rv" ]; then
        echo -e "${GREEN}PASS${NC}: POST /settings/validate-path"
        PASS=$((PASS + 1))
      else
        echo -e "${RED}FAIL${NC}: POST /settings/validate-path"
        diff --color=auto <(echo "$nv") <(echo "$rv") | head -20
        FAIL=$((FAIL + 1))
      fi
    else
      echo -e "${YELLOW}SKIP${NC}: POST /settings/validate-path (empty response)"
      SKIP=$((SKIP + 1))
    fi

    # Test 4: GET /settings/db-stats diff
    compare_endpoint "settings/db-stats" "GET /settings/db-stats (after mutations)"

    # Restore original settings on both backends
    RESTORE_AGENT=$(echo "$SETTINGS_BACKUP_NODE" | jq -c '{claudeCodePath: .claudeCodePath, claudeCodeEnabled: .claudeCodeEnabled, cursorPath: .cursorPath, cursorEnabled: .cursorEnabled}' 2>/dev/null)
    RESTORE_SYNC=$(echo "$SETTINGS_BACKUP_NODE" | jq -c '{syncEnabled: .syncEnabled, syncUrl: .syncUrl, syncFrequency: .syncFrequency, syncCategories: .syncCategories}' 2>/dev/null)

    if [ -n "$RESTORE_AGENT" ] && [ -n "$RESTORE_SYNC" ]; then
      curl -sf -X PUT -H 'Content-Type: application/json' -d "$RESTORE_AGENT" "$BASE_NODE/settings/agent" > /dev/null 2>&1
      curl -sf -X PUT -H 'Content-Type: application/json' -d "$RESTORE_AGENT" "$BASE_RUST/settings/agent" > /dev/null 2>&1
      curl -sf -X PUT -H 'Content-Type: application/json' -d "$RESTORE_SYNC" "$BASE_NODE/settings/sync" > /dev/null 2>&1
      curl -sf -X PUT -H 'Content-Type: application/json' -d "$RESTORE_SYNC" "$BASE_RUST/settings/sync" > /dev/null 2>&1
      echo -e "${GREEN}OK${NC}: Settings restored to original values"
    else
      echo -e "${YELLOW}WARN${NC}: Could not restore original settings"
    fi

    # Note: DELETE /settings/clear-db skipped in automated tests (too destructive, would need repopulation)
    echo -e "${YELLOW}NOTE${NC}: DELETE /settings/clear-db skipped (destructive -- verify manually)"
  fi
fi

echo ""
echo "================================================"
echo -e " Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${SKIP} skipped${NC}"
echo "================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
