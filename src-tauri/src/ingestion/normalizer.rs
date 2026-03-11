use std::collections::HashMap;
use std::sync::LazyLock;

use regex::Regex;

use super::compaction_utils::{compute_token_delta, strip_compaction_preamble};
use super::file_discovery::derive_project_name;
use super::id_generator::generate_id;
use super::title_utils::should_skip_for_title;
use super::types::{
    AssistantMessageData, CompactionEventRecord, ContentBlock, ConversationRecord, MessageRecord,
    NormalizedData, ParseResult, ToolCallRecord, ToolResultData, TokenUsageRecord,
};

/// Strip known system-injected XML tags, preserving legitimate XML in user content.
static SYSTEM_TAG_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"</?(system-reminder|local-command-caveat|local-command-stdout|command-name|command-message|command-args|antml:[a-z-]+)(?:\s[^>]*)?\s*/?>").unwrap()
});

static MULTI_NEWLINE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\n{3,}").unwrap());

/// Map parsed JSONL data into unified schema records ready for database insertion.
/// Returns None if there are no messages to normalize (empty file).
///
/// Records are returned in insertion order for foreign key compliance:
/// conversation -> messages -> toolCalls -> tokenUsage
pub fn normalize_conversation(
    parse_result: &ParseResult,
    project_dir: &str,
    session_id_override: Option<&str>,
) -> Option<NormalizedData> {
    // Empty files produce no conversation
    if parse_result.user_messages.is_empty() && parse_result.assistant_messages.is_empty() {
        return None;
    }

    // ── Conversation record ─────────────────────────────────────────────

    let session_id = session_id_override
        .map(|s| s.to_string())
        .or_else(|| parse_result.session_id.clone())
        .unwrap_or_default();

    let conversation_id = generate_id(&["claude-code", &session_id]);
    let project = Some(derive_project_name(project_dir));

    // Title: first non-empty user message content, truncated to 100 chars
    let title = derive_title(parse_result);

    // Timestamps: earliest and latest across all messages
    let mut sorted_timestamps = parse_result.timestamps.clone();
    sorted_timestamps.sort();
    let created_at = sorted_timestamps
        .first()
        .cloned()
        .unwrap_or_default();
    let updated_at = sorted_timestamps
        .last()
        .cloned()
        .unwrap_or_default();

    let mut conversation = ConversationRecord {
        id: conversation_id.clone(),
        agent: "claude-code".to_string(),
        project,
        title,
        created_at: created_at.clone(),
        updated_at,
        model: None, // Will be set after token usage
    };

    // ── Message records ─────────────────────────────────────────────────

    let mut messages: Vec<MessageRecord> = Vec::new();

    // Build a lookup of toolUseId -> ToolResultData for tool result matching
    let tool_result_lookup = build_tool_result_lookup(parse_result);

    // User messages
    for user in &parse_result.user_messages {
        messages.push(MessageRecord {
            id: generate_id(&[&conversation_id, &user.uuid]),
            conversation_id: conversation_id.clone(),
            role: "user".to_string(),
            content: user.content.clone(),
            thinking: None,
            created_at: user.timestamp.clone(),
            model: None,
        });
    }

    // Assistant messages
    for assistant in &parse_result.assistant_messages {
        let extracted = extract_assistant_content(&assistant.content_blocks);
        messages.push(MessageRecord {
            id: generate_id(&[&conversation_id, &assistant.first_uuid]),
            conversation_id: conversation_id.clone(),
            role: "assistant".to_string(),
            content: extracted.content,
            thinking: extracted.thinking,
            created_at: assistant.timestamp.clone(),
            model: Some(assistant.model.clone()),
        });
    }

    // ── Tool call records ───────────────────────────────────────────────

    let mut tool_calls: Vec<ToolCallRecord> = Vec::new();

    for assistant in &parse_result.assistant_messages {
        let assistant_message_id = generate_id(&[&conversation_id, &assistant.first_uuid]);

        for tool_use in &assistant.tool_use_blocks {
            let result = tool_result_lookup.get(&tool_use.id);
            let status = result.map(|r| {
                if tool_use.name == "ExitPlanMode" && r.is_error {
                    "rejected".to_string()
                } else if r.is_error {
                    "error".to_string()
                } else {
                    "success".to_string()
                }
            });

            tool_calls.push(ToolCallRecord {
                id: generate_id(&[&conversation_id, &tool_use.id]),
                message_id: assistant_message_id.clone(),
                conversation_id: conversation_id.clone(),
                name: tool_use.name.clone(),
                input: tool_use.input.clone(),
                output: result.map(|r| r.content.clone()),
                status,
                duration: None,
                created_at: assistant.timestamp.clone(),
            });
        }
    }

    // ── Token usage records ─────────────────────────────────────────────

    let mut token_usage: Vec<TokenUsageRecord> = Vec::new();

    for assistant in &parse_result.assistant_messages {
        if let Some(ref usage) = assistant.usage {
            let assistant_message_id = generate_id(&[&conversation_id, &assistant.first_uuid]);
            token_usage.push(TokenUsageRecord {
                id: generate_id(&[&conversation_id, &assistant.message_id]),
                conversation_id: conversation_id.clone(),
                message_id: Some(assistant_message_id),
                model: assistant.model.clone(),
                input_tokens: usage.input_tokens,
                output_tokens: usage.output_tokens,
                cache_read_tokens: usage.cache_read_input_tokens.unwrap_or(0),
                cache_creation_tokens: usage.cache_creation_input_tokens.unwrap_or(0),
                created_at: assistant.timestamp.clone(),
            });
        }
    }

    // ── Compaction event records ──────────────────────────────────────

    let mut compaction_events: Vec<CompactionEventRecord> = Vec::new();

    for event in &parse_result.compaction_events {
        let stripped_summary = event
            .summary
            .as_ref()
            .map(|s| strip_compaction_preamble(s));
        let (before, after) =
            compute_token_delta(&event.timestamp, &parse_result.assistant_messages);

        compaction_events.push(CompactionEventRecord {
            id: generate_id(&[&conversation_id, "compaction", &event.uuid]),
            conversation_id: conversation_id.clone(),
            timestamp: event.timestamp.clone(),
            summary: stripped_summary,
            tokens_before: before,
            tokens_after: after,
            created_at: event.timestamp.clone(),
        });
    }

    // Model: most frequent model from assistant messages, with token_usage fallback
    let model = derive_most_common_model(&parse_result.assistant_messages)
        .or_else(|| derive_most_common_model_from_token_usage(&token_usage));
    conversation.model = model;

    Some(NormalizedData {
        conversation,
        messages,
        tool_calls,
        token_usage,
        compaction_events,
    })
}

// ── Helpers ─────────────────────────────────────────────────────────────

fn strip_xml_tags(text: &str) -> String {
    let re = Regex::new(r"<[^>]*>").unwrap();
    re.replace_all(text, "").trim().to_string()
}

fn truncate(text: &str, max_len: usize) -> String {
    if text.len() > max_len {
        text[..max_len].to_string()
    } else {
        text.to_string()
    }
}

fn derive_title(parse_result: &ParseResult) -> Option<String> {
    // First pass: skip any user message matching skip patterns
    for user in &parse_result.user_messages {
        if let Some(ref content) = user.content {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                if should_skip_for_title(content) {
                    continue;
                }
                return Some(truncate(content, 100));
            }
        }
    }

    // Second pass: strip XML tags from XML messages and use first with >10 chars of cleaned text
    for user in &parse_result.user_messages {
        if let Some(ref content) = user.content {
            if content.trim().starts_with('<') {
                let stripped = strip_xml_tags(content);
                if stripped.len() > 10 {
                    return Some(truncate(&stripped, 100));
                }
            }
        }
    }

    // Third pass: fall back to first assistant message text content
    for assistant in &parse_result.assistant_messages {
        let extracted = extract_assistant_content(&assistant.content_blocks);
        if let Some(ref content) = extracted.content {
            if !content.trim().is_empty() {
                return Some(truncate(content, 100));
            }
        }
    }

    None
}

fn derive_most_common_model(assistant_messages: &[AssistantMessageData]) -> Option<String> {
    if assistant_messages.is_empty() {
        return None;
    }

    let mut counts: HashMap<&str, usize> = HashMap::new();
    for msg in assistant_messages {
        *counts.entry(&msg.model).or_insert(0) += 1;
    }

    counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(model, _)| model.to_string())
}

fn derive_most_common_model_from_token_usage(
    token_usage: &[TokenUsageRecord],
) -> Option<String> {
    if token_usage.is_empty() {
        return None;
    }

    let mut counts: HashMap<&str, usize> = HashMap::new();
    for tu in token_usage {
        *counts.entry(&tu.model).or_insert(0) += 1;
    }

    counts
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(model, _)| model.to_string())
}

fn build_tool_result_lookup(parse_result: &ParseResult) -> HashMap<String, ToolResultData> {
    let mut lookup: HashMap<String, ToolResultData> = HashMap::new();
    for user in &parse_result.user_messages {
        for tr in &user.tool_results {
            if let Some(existing) = lookup.get_mut(&tr.tool_use_id) {
                // Concatenate content -- agentId is often in the second tool_result block
                existing.content = format!("{}\n{}", existing.content, tr.content);
                existing.is_error = existing.is_error || tr.is_error;
            } else {
                lookup.insert(tr.tool_use_id.clone(), tr.clone());
            }
        }
    }
    lookup
}

fn strip_system_xml_tags(text: &str) -> String {
    let cleaned = SYSTEM_TAG_PATTERN.replace_all(text, "");
    let cleaned = MULTI_NEWLINE.replace_all(&cleaned, "\n\n");
    cleaned.trim().to_string()
}

struct ExtractedContent {
    content: Option<String>,
    thinking: Option<String>,
}

fn extract_assistant_content(blocks: &[ContentBlock]) -> ExtractedContent {
    let mut text_segments: Vec<String> = Vec::new();
    let mut thinking_segments: Vec<String> = Vec::new();
    let mut current_text = String::new();

    for block in blocks {
        match block {
            ContentBlock::Text { text } => {
                current_text.push_str(text);
            }
            ContentBlock::Thinking { thinking } => {
                if !current_text.is_empty() {
                    text_segments.push(std::mem::take(&mut current_text));
                }
                thinking_segments.push(thinking.clone());
            }
            _ => {
                // Non-text, non-thinking blocks (tool_use, tool_result) -- skip for content
                if !current_text.is_empty() {
                    text_segments.push(std::mem::take(&mut current_text));
                }
            }
        }
    }

    if !current_text.is_empty() {
        text_segments.push(current_text);
    }

    let raw_content = if text_segments.is_empty() {
        None
    } else {
        Some(text_segments.join("\n"))
    };

    let content = raw_content.map(|c| strip_system_xml_tags(&c));
    let content = content.and_then(|c| if c.is_empty() { None } else { Some(c) });

    let thinking = if thinking_segments.is_empty() {
        None
    } else {
        Some(thinking_segments.join("\n"))
    };

    ExtractedContent { content, thinking }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingestion::claude_code_parser::parse_jsonl_content;
    use crate::ingestion::types::TokenUsageRaw;

    fn make_test_jsonl() -> String {
        let lines = vec![
            r#"{"type":"user","uuid":"u1","sessionId":"sess-001","timestamp":"2024-01-01T10:00:00Z","message":{"role":"user","content":"Hello, help me write code"}}"#,
            r#"{"type":"assistant","uuid":"a1","sessionId":"sess-001","timestamp":"2024-01-01T10:00:01Z","message":{"role":"assistant","id":"msg-001","model":"claude-3-opus","content":[{"type":"thinking","thinking":"Let me think"},{"type":"text","text":"Sure, I can help."},{"type":"tool_use","id":"tu-001","name":"Write","input":{"path":"test.rs"}}],"stop_reason":"end_turn","usage":{"input_tokens":100,"output_tokens":50,"cache_read_input_tokens":20}}}"#,
            r#"{"type":"user","uuid":"u2","sessionId":"sess-001","timestamp":"2024-01-01T10:00:02Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu-001","content":"File written","is_error":false},{"type":"text","text":"Thanks!"}]}}"#,
            r#"{"type":"assistant","uuid":"a2","sessionId":"sess-001","timestamp":"2024-01-01T10:00:03Z","message":{"role":"assistant","id":"msg-002","model":"claude-3-opus","content":[{"type":"text","text":"You're welcome!"}],"stop_reason":"end_turn","usage":{"input_tokens":150,"output_tokens":30}}}"#,
        ];
        lines.join("\n")
    }

    #[test]
    fn normalize_produces_correct_records() {
        let content = make_test_jsonl();
        let parse_result = parse_jsonl_content(&content).unwrap();
        let normalized = normalize_conversation(&parse_result, "-Users-sachin-project", None).unwrap();

        // Conversation
        assert_eq!(normalized.conversation.agent, "claude-code");
        assert_eq!(normalized.conversation.project, Some("project".to_string()));
        assert_eq!(
            normalized.conversation.title,
            Some("Hello, help me write code".to_string())
        );
        assert_eq!(normalized.conversation.model, Some("claude-3-opus".to_string()));

        // Messages: 2 user + 2 assistant = 4
        assert_eq!(normalized.messages.len(), 4);

        let user_msgs: Vec<_> = normalized.messages.iter().filter(|m| m.role == "user").collect();
        assert_eq!(user_msgs.len(), 2);
        assert_eq!(user_msgs[0].content, Some("Hello, help me write code".to_string()));

        let asst_msgs: Vec<_> = normalized
            .messages
            .iter()
            .filter(|m| m.role == "assistant")
            .collect();
        assert_eq!(asst_msgs.len(), 2);
        // First assistant has thinking
        assert!(asst_msgs[0].thinking.is_some());
        assert_eq!(asst_msgs[0].thinking, Some("Let me think".to_string()));
        // First assistant has text content
        assert_eq!(asst_msgs[0].content, Some("Sure, I can help.".to_string()));

        // Tool calls: 1
        assert_eq!(normalized.tool_calls.len(), 1);
        assert_eq!(normalized.tool_calls[0].name, "Write");
        assert_eq!(normalized.tool_calls[0].output, Some("File written".to_string()));
        assert_eq!(normalized.tool_calls[0].status, Some("success".to_string()));

        // Token usage: 2 (one per assistant message with usage)
        assert_eq!(normalized.token_usage.len(), 2);
        assert_eq!(normalized.token_usage[0].input_tokens, 100);
        assert_eq!(normalized.token_usage[0].cache_read_tokens, 20);
    }

    #[test]
    fn normalize_empty_returns_none() {
        let parse_result = ParseResult {
            session_id: None,
            user_messages: vec![],
            assistant_messages: vec![],
            compaction_events: vec![],
            skipped_lines: 0,
            timestamps: vec![],
        };
        assert!(normalize_conversation(&parse_result, "test", None).is_none());
    }

    #[test]
    fn deterministic_ids() {
        let content = make_test_jsonl();
        let parse_result = parse_jsonl_content(&content).unwrap();
        let norm1 = normalize_conversation(&parse_result, "test", None).unwrap();
        let norm2 = normalize_conversation(&parse_result, "test", None).unwrap();

        assert_eq!(norm1.conversation.id, norm2.conversation.id);
        assert_eq!(norm1.messages[0].id, norm2.messages[0].id);
    }

    #[test]
    fn session_id_override() {
        let content = make_test_jsonl();
        let parse_result = parse_jsonl_content(&content).unwrap();
        let norm1 = normalize_conversation(&parse_result, "test", None).unwrap();
        let norm2 =
            normalize_conversation(&parse_result, "test", Some("custom-session")).unwrap();

        // Different session ID should produce different conversation ID
        assert_ne!(norm1.conversation.id, norm2.conversation.id);
    }

    #[test]
    fn system_xml_tags_stripped() {
        // Test that system-reminder tags are stripped but inner content preserved
        let input = "<system-reminder>Important</system-reminder> Hello world";
        let extracted = extract_assistant_content(&[ContentBlock::Text {
            text: input.to_string(),
        }]);
        assert_eq!(extracted.content, Some("Important Hello world".to_string()));
    }

    #[test]
    fn tool_result_concatenation_in_normalizer() {
        let lines = vec![
            r#"{"type":"assistant","uuid":"a1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","message":{"role":"assistant","id":"m1","model":"claude-3","content":[{"type":"tool_use","id":"tu1","name":"Read","input":{}}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}}}"#,
            r#"{"type":"user","uuid":"u1","sessionId":"s1","timestamp":"2024-01-01T10:00:01Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu1","content":"Part 1","is_error":false},{"type":"tool_result","tool_use_id":"tu1","content":"Part 2","is_error":false}]}}"#,
        ];
        let content = lines.join("\n");
        let parse_result = parse_jsonl_content(&content).unwrap();
        let normalized = normalize_conversation(&parse_result, "test", None).unwrap();

        // Tool call output should have concatenated content with \n
        assert_eq!(
            normalized.tool_calls[0].output,
            Some("Part 1\nPart 2".to_string())
        );
    }

    #[test]
    fn title_from_first_non_skippable_user() {
        let lines = vec![
            r#"{"type":"user","uuid":"u1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","message":{"role":"user","content":"/command"}}"#,
            r#"{"type":"user","uuid":"u2","sessionId":"s1","timestamp":"2024-01-01T10:00:01Z","message":{"role":"user","content":"Actual question here"}}"#,
        ];
        let content = lines.join("\n");
        let parse_result = parse_jsonl_content(&content).unwrap();
        let normalized = normalize_conversation(&parse_result, "test", None).unwrap();

        assert_eq!(
            normalized.conversation.title,
            Some("Actual question here".to_string())
        );
    }

    #[test]
    fn model_from_most_common_assistant() {
        let lines = vec![
            r#"{"type":"assistant","uuid":"a1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","message":{"role":"assistant","id":"m1","model":"claude-3-opus","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}}}"#,
            r#"{"type":"assistant","uuid":"a2","sessionId":"s1","timestamp":"2024-01-01T10:00:01Z","message":{"role":"assistant","id":"m2","model":"claude-3-sonnet","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}}}"#,
            r#"{"type":"assistant","uuid":"a3","sessionId":"s1","timestamp":"2024-01-01T10:00:02Z","message":{"role":"assistant","id":"m3","model":"claude-3-sonnet","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}}}"#,
        ];
        let content = lines.join("\n");
        let parse_result = parse_jsonl_content(&content).unwrap();
        let normalized = normalize_conversation(&parse_result, "test", None).unwrap();

        assert_eq!(
            normalized.conversation.model,
            Some("claude-3-sonnet".to_string())
        );
    }

    #[test]
    fn compaction_events_normalized() {
        let lines = vec![
            r#"{"type":"assistant","uuid":"a1","sessionId":"s1","timestamp":"2024-01-01T09:00:00Z","message":{"role":"assistant","id":"m1","model":"claude-3","content":[{"type":"text","text":"hi"}],"stop_reason":"end_turn","usage":{"input_tokens":1000,"output_tokens":500,"cache_read_input_tokens":200}}}"#,
            r#"{"type":"user","uuid":"c1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","isCompactSummary":true,"message":{"role":"user","content":"This session is being continued from a previous conversation.\n\nActual summary."}}"#,
            r#"{"type":"assistant","uuid":"a2","sessionId":"s1","timestamp":"2024-01-01T11:00:00Z","message":{"role":"assistant","id":"m2","model":"claude-3","content":[{"type":"text","text":"continuing"}],"stop_reason":"end_turn","usage":{"input_tokens":500,"output_tokens":200}}}"#,
        ];
        let content = lines.join("\n");
        let parse_result = parse_jsonl_content(&content).unwrap();
        let normalized = normalize_conversation(&parse_result, "test", None).unwrap();

        assert_eq!(normalized.compaction_events.len(), 1);
        assert_eq!(
            normalized.compaction_events[0].summary,
            Some("Actual summary.".to_string())
        );
        assert_eq!(normalized.compaction_events[0].tokens_before, Some(1200)); // 1000 + 200
        assert_eq!(normalized.compaction_events[0].tokens_after, Some(500)); // 500 + 0
    }
}
