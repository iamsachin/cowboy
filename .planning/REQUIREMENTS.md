# Requirements: Cowboy

**Defined:** 2026-03-05
**Core Value:** Give developers a single, unified view of how their coding agents are performing — every conversation, tool call, token, and plan across all agents in one place.

## v1.2 Requirements

Requirements for Data Quality & Display Fixes milestone. Each maps to roadmap phases.

### Title Extraction

- [x] **TITLE-01**: Conversation title uses first real user message, skipping system caveats (`Caveat: The messages below...`)
- [x] **TITLE-02**: Conversation title skips `[Request interrupted by user for tool use]` system messages
- [x] **TITLE-03**: Conversation title skips `/clear` and other slash-only messages to find meaningful content

### Model Attribution

- [x] **MODEL-01**: Conversation-level model is derived from most common model in messages/token_usage when NULL
- [x] **MODEL-02**: Cursor "default" model is handled gracefully (show actual model or "unknown")

### Cursor Data Quality

- [ ] **CURSOR-01**: Cursor assistant responses display actual content instead of "Empty response"
- [ ] **CURSOR-02**: Cursor agent appears in the conversation filter dropdown
- [ ] **CURSOR-03**: Cursor project shows workspace path instead of literal "Cursor"

### Message Display

- [ ] **MSG-01**: System-injected content (caveats, skill instructions, objective blocks) stored as role=user is visually distinguished from actual user messages
- [ ] **MSG-02**: Slash commands (`/clear`, `/gsd:*`) are styled distinctly from regular messages

## Future Requirements

None currently deferred.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cursor tool call extraction | Cursor doesn't expose structured tool call data in its storage |
| Cursor cache token tracking | Cursor doesn't expose cache read/creation token counts |
| ~~Re-ingestion of existing data~~ | ~~Addressed by 14-02 startup migration that retroactively fixes existing data~~ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TITLE-01 | Phase 14 | Complete |
| TITLE-02 | Phase 14 | Complete |
| TITLE-03 | Phase 14 | Complete |
| MODEL-01 | Phase 14 | Complete |
| MODEL-02 | Phase 14 | Complete |
| CURSOR-01 | Phase 15 | Pending |
| CURSOR-02 | Phase 15 | Pending |
| CURSOR-03 | Phase 15 | Pending |
| MSG-01 | Phase 16 | Pending |
| MSG-02 | Phase 16 | Pending |

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after phase 14 completion*
