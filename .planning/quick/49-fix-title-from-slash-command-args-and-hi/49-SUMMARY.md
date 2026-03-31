---
phase: quick-49
plan: 01
subsystem: ingestion, frontend
tags: [title-derivation, slash-commands, ui-highlighting]
dependency_graph:
  requires: []
  provides: [slash-command-arg-titles, inline-command-highlighting]
  affects: [conversation-titles, chat-message-display]
tech_stack:
  added: []
  patterns: [xml-arg-extraction, regex-based-highlighting]
key_files:
  created: []
  modified:
    - src-tauri/src/ingestion/title_utils.rs
    - src-tauri/src/ingestion/normalizer.rs
    - packages/frontend/src/utils/content-sanitizer.ts
    - packages/frontend/src/components/ChatMessage.vue
    - packages/frontend/tests/utils/content-sanitizer.test.ts
decisions:
  - Extract command-args from XML format directly rather than stripping tags first to avoid losing whitespace between command and args
metrics:
  duration: 225s
  completed: "2026-03-31T12:45:24Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 49: Fix Title from Slash Command Args and Highlight Commands

Slash command args now drive conversation titles (extract_slash_command_args handles both XML and plain formats) and command names render with info-colored mono styling in chat bubbles plus inline highlighting in regular messages.

## Task Summary

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extract slash command args for title derivation in Rust | d3cf47c | title_utils.rs, normalizer.rs |
| 2 | Highlight slash command name inline in ChatMessage | 82582cc | content-sanitizer.ts, ChatMessage.vue |

## Changes Made

### Task 1: Rust Title Derivation
- Added `extract_slash_command_args()` in title_utils.rs supporting both XML (`<command-args>`) and plain (`/cmd args`) formats
- Updated second pass in `derive_conversation_title()` to try XML arg extraction before tag stripping
- Mirrored the same fix in normalizer.rs `derive_title()`
- Args must be >10 chars to be used as title (short args like "clear" fall through)
- Added 4 new tests, all 26 title_utils tests pass

### Task 2: Frontend Command Highlighting
- Added `extractCommandParts()` to split XML slash command into command name and args
- Added `highlightSlashCommands()` for detecting inline `/command` patterns in regular text (preceded by whitespace or start-of-string, avoiding URL paths)
- Updated ChatMessage.vue template to render command name with `text-info font-mono font-semibold` styling
- Updated `linkify()` to apply `highlightSlashCommands` before URL linking
- Added `span` and `class` to DOMPurify ALLOWED_TAGS/ALLOWED_ATTR
- Added 9 new tests (3 extractCommandParts + 5 highlightSlashCommands + existing), all 17 sanitizer tests pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] XML tag stripping loses whitespace between command and args**
- **Found during:** Task 1
- **Issue:** `strip_xml_tags` on `<command-name>/gsd:quick</command-name><command-args>How...</command-args>` produces `/gsd:quickHow...` (no space), causing the command regex to consume "How" as part of the command name
- **Fix:** Parse `<command-args>` XML directly in `extract_slash_command_args` before falling back to plain text splitting
- **Files modified:** title_utils.rs
- **Commit:** d3cf47c

## Verification Results

- `cargo test --lib ingestion::title_utils`: 26 passed, 0 failed
- `npx vitest run content-sanitizer.test.ts`: 17 passed, 0 failed
- `cargo build`: no new warnings
