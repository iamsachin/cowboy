use super::types::{ParseResult, NormalizedData};

/// Map parsed JSONL data into unified schema records ready for database insertion.
/// Returns None if there are no messages to normalize (empty file).
pub fn normalize_conversation(
    _parse_result: &ParseResult,
    _project_dir: &str,
    _session_id_override: Option<&str>,
) -> Option<NormalizedData> {
    todo!("Implemented in Task 2")
}
