use regex::Regex;
use std::sync::LazyLock;

use super::types::AssistantMessageData;

// ── Preamble stripping ──────────────────────────────────────────────────

static COMPACTION_PREAMBLE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?s)^This session is being continued from a previous conversation.*?\n\n").unwrap()
});

/// Remove the boilerplate preamble from compaction summaries.
/// Falls back to returning full text if preamble pattern is not found.
pub fn strip_compaction_preamble(summary: &str) -> String {
    COMPACTION_PREAMBLE.replace(summary, "").trim().to_string()
}

// ── Token delta computation ─────────────────────────────────────────────

/// Compute input token counts before and after a compaction boundary.
/// Uses input_tokens + cache_read_input_tokens + cache_creation_input_tokens
/// from the last assistant message before and first assistant message after.
pub fn compute_token_delta(
    compaction_timestamp: &str,
    assistant_messages: &[AssistantMessageData],
) -> (Option<i64>, Option<i64>) {
    let mut sorted: Vec<&AssistantMessageData> = assistant_messages
        .iter()
        .filter(|m| m.usage.is_some())
        .collect();
    sorted.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    let last_before = sorted
        .iter()
        .filter(|m| m.timestamp.as_str() < compaction_timestamp)
        .last()
        .copied();

    let first_after = sorted
        .iter()
        .find(|m| m.timestamp.as_str() > compaction_timestamp)
        .copied();

    let sum_tokens = |u: &super::types::TokenUsageRaw| -> i64 {
        u.input_tokens
            + u.cache_read_input_tokens.unwrap_or(0)
            + u.cache_creation_input_tokens.unwrap_or(0)
    };

    let before = last_before.and_then(|m| m.usage.as_ref().map(sum_tokens));
    let after = first_after.and_then(|m| m.usage.as_ref().map(sum_tokens));

    (before, after)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingestion::types::{AssistantMessageData, TokenUsageRaw};

    #[test]
    fn strip_preamble_removes_prefix() {
        let summary = "This session is being continued from a previous conversation. Here is the summary:\n\nActual content here.";
        assert_eq!(strip_compaction_preamble(summary), "Actual content here.");
    }

    #[test]
    fn strip_preamble_no_match() {
        let summary = "Normal summary without preamble.";
        assert_eq!(strip_compaction_preamble(summary), "Normal summary without preamble.");
    }

    #[test]
    fn compute_delta_correct() {
        let msgs = vec![
            AssistantMessageData {
                first_uuid: "u1".to_string(),
                message_id: "m1".to_string(),
                timestamp: "2024-01-01T10:00:00Z".to_string(),
                model: "claude-3".to_string(),
                content_blocks: vec![],
                tool_use_blocks: vec![],
                usage: Some(TokenUsageRaw {
                    input_tokens: 1000,
                    output_tokens: 500,
                    cache_read_input_tokens: Some(200),
                    cache_creation_input_tokens: Some(100),
                }),
                stop_reason: "end_turn".to_string(),
            },
            AssistantMessageData {
                first_uuid: "u2".to_string(),
                message_id: "m2".to_string(),
                timestamp: "2024-01-01T12:00:00Z".to_string(),
                model: "claude-3".to_string(),
                content_blocks: vec![],
                tool_use_blocks: vec![],
                usage: Some(TokenUsageRaw {
                    input_tokens: 500,
                    output_tokens: 200,
                    cache_read_input_tokens: Some(50),
                    cache_creation_input_tokens: None,
                }),
                stop_reason: "end_turn".to_string(),
            },
        ];

        let (before, after) = compute_token_delta("2024-01-01T11:00:00Z", &msgs);
        assert_eq!(before, Some(1300)); // 1000 + 200 + 100
        assert_eq!(after, Some(550));   // 500 + 50 + 0
    }

    #[test]
    fn compute_delta_no_messages() {
        let (before, after) = compute_token_delta("2024-01-01T11:00:00Z", &[]);
        assert_eq!(before, None);
        assert_eq!(after, None);
    }
}
