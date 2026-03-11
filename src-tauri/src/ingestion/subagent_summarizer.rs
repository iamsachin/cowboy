use std::collections::{HashMap, HashSet};

use super::types::ParseResult;

// File path keys commonly found in tool_use input
const FILE_PATH_KEYS: &[&str] = &["file_path", "path", "filePath"];

/// Summary statistics for a subagent conversation.
#[derive(Debug, Clone)]
pub struct SubagentSummary {
    pub tool_breakdown: HashMap<String, u32>,
    pub files_touched: Vec<String>,
    pub total_tool_calls: usize,
    pub status: SubagentStatus,
    pub duration_ms: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SubagentStatus {
    Success,
    Error,
    Interrupted,
}

impl SubagentStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            SubagentStatus::Success => "success",
            SubagentStatus::Error => "error",
            SubagentStatus::Interrupted => "interrupted",
        }
    }
}

/// Parse a subagent's ParseResult to extract summary statistics.
pub fn summarize_subagent(parse_result: &ParseResult) -> SubagentSummary {
    // ── Tool breakdown ─────────────────────────────────────────────────
    let mut tool_breakdown: HashMap<String, u32> = HashMap::new();
    let mut files_touched_set: HashSet<String> = HashSet::new();
    let mut total_tool_calls: usize = 0;

    for assistant in &parse_result.assistant_messages {
        for tool_use in &assistant.tool_use_blocks {
            total_tool_calls += 1;
            *tool_breakdown.entry(tool_use.name.clone()).or_insert(0) += 1;

            // Extract file paths from input
            if let Some(obj) = tool_use.input.as_object() {
                for key in FILE_PATH_KEYS {
                    if let Some(val) = obj.get(*key) {
                        if let Some(s) = val.as_str() {
                            if !s.is_empty() {
                                files_touched_set.insert(s.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Status ─────────────────────────────────────────────────────────
    let all_tool_results: Vec<_> = parse_result
        .user_messages
        .iter()
        .flat_map(|u| &u.tool_results)
        .collect();

    let has_error = all_tool_results.iter().any(|tr| tr.is_error);
    let last_assistant = parse_result.assistant_messages.last();

    let status = if parse_result.assistant_messages.is_empty() {
        SubagentStatus::Interrupted
    } else if has_error && all_tool_results.last().map_or(false, |tr| tr.is_error) {
        SubagentStatus::Error
    } else if last_assistant.map_or(false, |a| a.stop_reason != "end_turn") {
        SubagentStatus::Interrupted
    } else {
        SubagentStatus::Success
    };

    // ── Duration ───────────────────────────────────────────────────────
    let mut sorted_timestamps: Vec<&str> = parse_result
        .timestamps
        .iter()
        .map(|s| s.as_str())
        .collect();
    sorted_timestamps.sort();

    let duration_ms = if let (Some(&first), Some(&last)) =
        (sorted_timestamps.first(), sorted_timestamps.last())
    {
        // Parse ISO timestamps to compute delta
        chrono::DateTime::parse_from_rfc3339(last)
            .ok()
            .zip(chrono::DateTime::parse_from_rfc3339(first).ok())
            .map(|(l, f)| (l - f).num_milliseconds())
            .unwrap_or(0)
    } else {
        0
    };

    // ── Tokens ─────────────────────────────────────────────────────────
    let mut input_tokens: i64 = 0;
    let mut output_tokens: i64 = 0;
    for assistant in &parse_result.assistant_messages {
        if let Some(ref usage) = assistant.usage {
            input_tokens += usage.input_tokens;
            output_tokens += usage.output_tokens;
        }
    }

    // ── Last error ─────────────────────────────────────────────────────
    let error_results: Vec<_> = all_tool_results.iter().filter(|tr| tr.is_error).collect();
    let last_error = error_results.last().map(|tr| tr.content.clone());

    SubagentSummary {
        tool_breakdown,
        files_touched: files_touched_set.into_iter().collect(),
        total_tool_calls,
        status,
        duration_ms,
        input_tokens,
        output_tokens,
        last_error,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingestion::types::{
        AssistantMessageData, ContentBlock, TokenUsageRaw, ToolResultData, ToolUseBlock,
        UserMessageData,
    };

    fn make_test_parse_result() -> ParseResult {
        ParseResult {
            session_id: Some("test-session".to_string()),
            user_messages: vec![UserMessageData {
                uuid: "u1".to_string(),
                timestamp: "2024-01-01T10:00:00Z".to_string(),
                content: None,
                tool_results: vec![ToolResultData {
                    tool_use_id: "tu1".to_string(),
                    content: "File written".to_string(),
                    is_error: false,
                }],
            }],
            assistant_messages: vec![AssistantMessageData {
                first_uuid: "a1".to_string(),
                message_id: "msg1".to_string(),
                timestamp: "2024-01-01T10:00:01Z".to_string(),
                model: "claude-3".to_string(),
                content_blocks: vec![ContentBlock::Text {
                    text: "Done".to_string(),
                }],
                tool_use_blocks: vec![
                    ToolUseBlock {
                        id: "tu1".to_string(),
                        name: "Write".to_string(),
                        input: serde_json::json!({"file_path": "/src/main.rs", "content": "fn main(){}"}),
                    },
                    ToolUseBlock {
                        id: "tu2".to_string(),
                        name: "Read".to_string(),
                        input: serde_json::json!({"path": "/src/lib.rs"}),
                    },
                    ToolUseBlock {
                        id: "tu3".to_string(),
                        name: "Write".to_string(),
                        input: serde_json::json!({"file_path": "/src/utils.rs", "content": "pub fn x(){}"}),
                    },
                ],
                usage: Some(TokenUsageRaw {
                    input_tokens: 100,
                    output_tokens: 50,
                    cache_read_input_tokens: None,
                    cache_creation_input_tokens: None,
                }),
                stop_reason: "end_turn".to_string(),
            }],
            compaction_events: vec![],
            skipped_lines: 0,
            timestamps: vec![
                "2024-01-01T10:00:00Z".to_string(),
                "2024-01-01T10:00:05Z".to_string(),
            ],
        }
    }

    #[test]
    fn summarize_tool_breakdown() {
        let pr = make_test_parse_result();
        let summary = summarize_subagent(&pr);
        assert_eq!(summary.tool_breakdown.get("Write"), Some(&2));
        assert_eq!(summary.tool_breakdown.get("Read"), Some(&1));
        assert_eq!(summary.total_tool_calls, 3);
    }

    #[test]
    fn summarize_files_touched() {
        let pr = make_test_parse_result();
        let summary = summarize_subagent(&pr);
        let mut files: Vec<String> = summary.files_touched;
        files.sort();
        assert_eq!(files.len(), 3);
        assert!(files.contains(&"/src/main.rs".to_string()));
        assert!(files.contains(&"/src/lib.rs".to_string()));
        assert!(files.contains(&"/src/utils.rs".to_string()));
    }

    #[test]
    fn summarize_status_success() {
        let pr = make_test_parse_result();
        let summary = summarize_subagent(&pr);
        assert_eq!(summary.status, SubagentStatus::Success);
    }

    #[test]
    fn summarize_status_interrupted_no_assistant() {
        let mut pr = make_test_parse_result();
        pr.assistant_messages.clear();
        let summary = summarize_subagent(&pr);
        assert_eq!(summary.status, SubagentStatus::Interrupted);
    }

    #[test]
    fn summarize_status_interrupted_non_end_turn() {
        let mut pr = make_test_parse_result();
        pr.assistant_messages[0].stop_reason = "max_tokens".to_string();
        let summary = summarize_subagent(&pr);
        assert_eq!(summary.status, SubagentStatus::Interrupted);
    }

    #[test]
    fn summarize_status_error_last_tool_result() {
        let mut pr = make_test_parse_result();
        pr.user_messages[0].tool_results = vec![ToolResultData {
            tool_use_id: "tu1".to_string(),
            content: "Permission denied".to_string(),
            is_error: true,
        }];
        let summary = summarize_subagent(&pr);
        assert_eq!(summary.status, SubagentStatus::Error);
        assert_eq!(summary.last_error, Some("Permission denied".to_string()));
    }

    #[test]
    fn summarize_duration_and_tokens() {
        let pr = make_test_parse_result();
        let summary = summarize_subagent(&pr);
        assert_eq!(summary.duration_ms, 5000); // 5 seconds
        assert_eq!(summary.input_tokens, 100);
        assert_eq!(summary.output_tokens, 50);
    }
}
