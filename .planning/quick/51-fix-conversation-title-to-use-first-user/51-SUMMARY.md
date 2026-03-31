---
phase: quick-51
plan: 01
one_liner: "/clear-aware title derivation with [Image #N] stripping"
completed: "2026-03-31T13:11:25Z"
duration: "3m"
tasks_completed: 2
tasks_total: 2
commits:
  - hash: deb7404
    type: test
    description: "Add failing tests for /clear-aware title derivation"
  - hash: 213a75a
    type: feat
    description: "Add is_clear_command, update strip_image_refs, make title /clear-aware"
  - hash: 31dc511
    type: test
    description: "Add failing tests for normalizer /clear-aware title derivation"
  - hash: 702743d
    type: feat
    description: "Make normalizer derive_title skip messages before last /clear"
key_files:
  modified:
    - src-tauri/src/ingestion/title_utils.rs
    - src-tauri/src/ingestion/normalizer.rs
decisions:
  - "Used rposition to find last /clear index for efficient reverse scanning"
  - "Combined [Image: ...] and [Image #N] into single regex with alternation"
---

# Quick Task 51: Fix Conversation Title to Use First User Message After /clear

/clear-aware title derivation ensuring conversations that contain /clear derive their title from messages after the last clear, plus [Image #N] pattern stripping.

## Changes Made

### Task 1: title_utils.rs - is_clear_command, strip_image_refs update, /clear-aware derive_conversation_title

- Added `pub fn is_clear_command(content: &str) -> bool` that detects both plain `/clear` and XML-wrapped `<command-name>/clear</command-name>` formats
- Updated `strip_image_refs` regex from `\[Image: source: [^\]]+\]` to `\[Image:[ ][^\]]+\]|\[Image #\d+\]` to handle both `[Image: source: ...]` and `[Image #N]` patterns
- Updated `derive_conversation_title` to find last /clear via `rposition`, create a post-clear slice, and use that slice for passes 1-3 (user message passes); pass 4 (assistant fallback) remains unchanged
- Added 11 new tests covering all behaviors

### Task 2: normalizer.rs - /clear-aware derive_title

- Added `is_clear_command` to the import from title_utils
- Updated `derive_title` to find last /clear index via `rposition` on `parse_result.user_messages` and slice accordingly
- Passes 1-3 iterate over `user_slice` instead of full `parse_result.user_messages`
- Pass 4 (assistant fallback) unchanged
- Added 3 new tests: plain /clear, XML /clear, and /clear-only-falls-to-assistant

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All 110 ingestion tests pass including 14 new tests for /clear detection, [Image #N] stripping, and post-clear title derivation.

## Self-Check: PASSED
