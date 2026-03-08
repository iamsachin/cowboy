# Deferred Items - Phase 19

## Pre-existing Test Failures

- **tests/app.test.ts**: "has exactly 6 named routes plus the redirect" expects 6 routes but finds 8. Route count assertion is stale — not caused by phase 19 changes.
