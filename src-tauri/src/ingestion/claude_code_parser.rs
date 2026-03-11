use super::types::ParseResult;

/// Parse a Claude Code JSONL file line-by-line using streaming I/O.
/// Reconstructs multi-chunk assistant messages into single messages,
/// extracting token usage from the final chunk only.
pub async fn parse_jsonl_file(_file_path: &str) -> Result<ParseResult, Box<dyn std::error::Error + Send + Sync>> {
    todo!("Implemented in Task 2")
}
