#!/bin/bash
# scripts/diff-backends.sh
# Compare Node.js (:3000) vs Rust (:3001) API responses
# Primary validation artifact for Phase 37: zero differences on all read endpoints
#
# Usage:
#   ./scripts/diff-backends.sh           # Test all endpoints
#   ./scripts/diff-backends.sh --all     # Same as above
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

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --all)
      shift
      ;;
    --endpoint)
      SINGLE_ENDPOINT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--all | --endpoint NAME]"
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
)

echo "================================================"
echo " Cowboy Backend Diff: Node.js vs Rust"
echo " Node: $BASE_NODE"
echo " Rust: $BASE_RUST"
echo "================================================"
echo ""

if [ -n "$SINGLE_ENDPOINT" ]; then
  compare_endpoint "$SINGLE_ENDPOINT"
else
  echo "--- Static Endpoints ---"
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

echo ""
echo "================================================"
echo -e " Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}, ${YELLOW}${SKIP} skipped${NC}"
echo "================================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
