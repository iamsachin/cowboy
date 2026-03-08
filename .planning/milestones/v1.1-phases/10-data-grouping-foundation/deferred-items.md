# Deferred Items - Phase 10

## Pre-existing Test Failure

- **File:** `packages/frontend/tests/app.test.ts`
- **Test:** `Router Configuration > has exactly 6 named routes plus the redirect`
- **Issue:** Test expects 6 named routes but router has 8 (likely routes added in earlier phases without updating this test)
- **Discovered during:** 10-02 Task 2 verification
- **Not caused by:** Plan 10-02 changes (no router modifications)
