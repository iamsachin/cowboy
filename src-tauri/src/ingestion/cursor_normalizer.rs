use std::collections::{HashMap, HashSet};

use serde_json::Value;

use super::cursor_parser::{CursorBubble, CursorConversation};
use super::id_generator::generate_id;
use super::title_utils::should_skip_for_title;
use super::types::{
    CompactionEventRecord, ConversationRecord, MessageRecord, NormalizedData, ToolCallRecord,
    TokenUsageRecord,
};

/// Normalize a Cursor conversation and its bubbles into the unified schema.
/// Returns None if there are no bubbles (empty conversation).
///
/// Uses deterministic IDs based on composerId so re-ingestion produces no duplicates.
pub fn normalize_cursor_conversation(
    conv: &CursorConversation,
    bubbles: &[CursorBubble],
    project: &str,
) -> Option<NormalizedData> {
    if bubbles.is_empty() {
        return None;
    }

    let conversation_id = generate_id(&["cursor", &conv.composer_id]);

    let title = derive_title(bubbles);
    let created_at = normalize_cursor_timestamp_f64(conv.created_at);
    let last_updated = if conv.last_updated_at > 0.0 {
        conv.last_updated_at
    } else {
        conv.created_at
    };
    let updated_at = normalize_cursor_timestamp_f64(last_updated);
    let model = derive_model(conv, bubbles);

    let conversation = ConversationRecord {
        id: conversation_id.clone(),
        agent: "cursor".to_string(),
        project: Some(project.to_string()),
        title,
        created_at,
        updated_at,
        model,
    };

    // ── Messages ──────────────────────────────────────────────────────────

    let mut normalized_messages: Vec<MessageRecord> = Vec::new();
    let mut normalized_tool_calls: Vec<ToolCallRecord> = Vec::new();
    let mut included_bubble_ids: HashSet<String> = HashSet::new();
    let mut bubble_to_merged_id: HashMap<String, String> = HashMap::new();

    let mut i = 0;
    while i < bubbles.len() {
        let bubble = &bubbles[i];
        let role = match bubble.bubble_type {
            1 => "user",
            2 => "assistant",
            _ => {
                i += 1;
                continue;
            }
        };

        // User bubbles emitted directly
        if role == "user" {
            included_bubble_ids.insert(bubble.bubble_id.clone());
            let message_id = generate_id(&[&conversation_id, &bubble.bubble_id]);
            let bubble_timestamp = derive_bubble_timestamp(bubble, conv);
            normalized_messages.push(MessageRecord {
                id: message_id,
                conversation_id: conversation_id.clone(),
                role: "user".to_string(),
                content: if bubble.text.is_empty() {
                    None
                } else {
                    Some(bubble.text.clone())
                },
                thinking: None,
                created_at: bubble_timestamp,
                model: None,
            });
            i += 1;
            continue;
        }

        // Collect consecutive assistant bubbles into a logical turn
        let mut assistant_group: Vec<&CursorBubble> = Vec::new();
        while i < bubbles.len() {
            let b = &bubbles[i];
            if b.bubble_type != 2 {
                break;
            }
            assistant_group.push(b);
            i += 1;
        }

        // Merge the assistant group into a single message
        let mut thinking_segments: Vec<String> = Vec::new();
        let mut text_segments: Vec<String> = Vec::new();
        let mut tool_count = 0;
        let first_bubble = assistant_group[0];
        let mut pending_tool_calls: Vec<&CursorBubble> = Vec::new();

        for b in &assistant_group {
            // Extract thinking content
            if let Some(ref thinking_val) = b.thinking {
                if let Some(text) = thinking_val.get("text").and_then(|t| t.as_str()) {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        thinking_segments.push(text.to_string());
                    }
                }
            }

            // Check if tool-only bubble
            let has_text = !b.text.trim().is_empty();
            let has_thinking = b
                .thinking
                .as_ref()
                .and_then(|v| v.get("text"))
                .and_then(|t| t.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false);
            let is_tool_only =
                !has_text && !has_thinking && (b.capability_type.is_some() || !b.tool_former_data.is_null());

            if is_tool_only {
                tool_count += 1;
                // Collect tool call data if toolFormerData has a name
                if b.tool_former_data
                    .get("name")
                    .and_then(|n| n.as_str())
                    .is_some()
                {
                    pending_tool_calls.push(b);
                }
            } else if has_text {
                text_segments.push(b.text.trim().to_string());
            }
        }

        // Build merged content
        let merged_content = if !text_segments.is_empty() {
            let mut content = text_segments.join("\n\n");
            if tool_count > 0 {
                let plural = if tool_count != 1 { "s" } else { "" };
                content = format!("Executed {} tool call{}\n\n{}", tool_count, plural, content);
            }
            Some(content)
        } else if tool_count > 0 {
            let plural = if tool_count != 1 { "s" } else { "" };
            Some(format!("Executed {} tool call{}", tool_count, plural))
        } else {
            None
        };

        let merged_thinking = if thinking_segments.is_empty() {
            None
        } else {
            Some(thinking_segments.join("\n\n"))
        };

        // Derive model from first bubble with modelInfo
        let model_bubble = assistant_group
            .iter()
            .find(|b| {
                b.model_info
                    .as_ref()
                    .and_then(|m| m.get("modelName"))
                    .and_then(|n| n.as_str())
                    .is_some()
            })
            .unwrap_or(&first_bubble);

        let raw_model = model_bubble
            .model_info
            .as_ref()
            .and_then(|m| m.get("modelName"))
            .and_then(|n| n.as_str())
            .or_else(|| {
                conv.model_config
                    .get("modelName")
                    .and_then(|n| n.as_str())
            });
        let bubble_model = raw_model.map(|m| {
            if m == "default" {
                "unknown".to_string()
            } else {
                m.to_string()
            }
        });

        let message_id = generate_id(&[&conversation_id, &first_bubble.bubble_id]);
        let bubble_timestamp = derive_bubble_timestamp(first_bubble, conv);

        // Track all bubble IDs in the group
        for b in &assistant_group {
            included_bubble_ids.insert(b.bubble_id.clone());
            bubble_to_merged_id.insert(b.bubble_id.clone(), first_bubble.bubble_id.clone());
        }

        normalized_messages.push(MessageRecord {
            id: message_id.clone(),
            conversation_id: conversation_id.clone(),
            role: "assistant".to_string(),
            content: merged_content,
            thinking: merged_thinking,
            created_at: bubble_timestamp,
            model: bubble_model,
        });

        // Extract tool calls from pending bubbles
        for tb in &pending_tool_calls {
            let tfd = &tb.tool_former_data;
            let tool_name = tfd.get("name").and_then(|n| n.as_str()).unwrap_or("");
            let tool_call_id = tfd
                .get("toolCallId")
                .and_then(|n| n.as_str())
                .unwrap_or(&tb.bubble_id);

            let input = safe_json_parse(
                tfd.get("params")
                    .and_then(|v| v.as_str())
                    .or_else(|| tfd.get("rawArgs").and_then(|v| v.as_str())),
            );
            let output = safe_json_parse_with_fallback(tfd.get("result").and_then(|v| v.as_str()));
            let status = map_tool_status(tfd.get("status").and_then(|s| s.as_str()));

            normalized_tool_calls.push(ToolCallRecord {
                id: generate_id(&[&conversation_id, tool_call_id]),
                message_id: message_id.clone(),
                conversation_id: conversation_id.clone(),
                name: tool_name.to_string(),
                input: input.unwrap_or(Value::Null),
                output: output.map(|v| {
                    if v.is_string() {
                        v.as_str().unwrap().to_string()
                    } else {
                        v.to_string()
                    }
                }),
                status,
                duration: None,
                created_at: derive_bubble_timestamp(tb, conv),
            });
        }
    }

    // ── Token usage ────────────────────────────────────────────────────────

    let mut normalized_token_usage: Vec<TokenUsageRecord> = Vec::new();
    let mut prev_cumulative_tokens: f64 = 0.0;

    for bubble in bubbles {
        if bubble.bubble_type != 2 {
            continue;
        }

        let has_message = included_bubble_ids.contains(&bubble.bubble_id);

        let input_tokens = bubble
            .token_count
            .as_ref()
            .and_then(|tc| tc.get("inputTokens"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        let output_tokens = bubble
            .token_count
            .as_ref()
            .and_then(|tc| tc.get("outputTokens"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);

        if (input_tokens > 0 || output_tokens > 0) && has_message {
            let merged_bubble_id = bubble_to_merged_id
                .get(&bubble.bubble_id)
                .unwrap_or(&bubble.bubble_id);
            let msg_id = generate_id(&[&conversation_id, merged_bubble_id]);
            let raw_model = bubble
                .model_info
                .as_ref()
                .and_then(|m| m.get("modelName"))
                .and_then(|n| n.as_str())
                .or_else(|| {
                    conv.model_config
                        .get("modelName")
                        .and_then(|n| n.as_str())
                })
                .unwrap_or("unknown");
            let token_model = if raw_model == "default" {
                "unknown"
            } else {
                raw_model
            };

            normalized_token_usage.push(TokenUsageRecord {
                id: generate_id(&[&conversation_id, &format!("token-{}", bubble.bubble_id)]),
                conversation_id: conversation_id.clone(),
                message_id: Some(msg_id),
                model: token_model.to_string(),
                input_tokens,
                output_tokens,
                cache_read_tokens: 0,
                cache_creation_tokens: 0,
                created_at: derive_bubble_timestamp(bubble, conv),
            });
        } else if let Some(cumulative) = bubble.token_count_up_until_here {
            if cumulative > prev_cumulative_tokens && has_message {
                let estimated_output = (cumulative - prev_cumulative_tokens) as i64;
                let merged_bubble_id = bubble_to_merged_id
                    .get(&bubble.bubble_id)
                    .unwrap_or(&bubble.bubble_id);
                let msg_id = generate_id(&[&conversation_id, merged_bubble_id]);
                let raw_model = bubble
                    .model_info
                    .as_ref()
                    .and_then(|m| m.get("modelName"))
                    .and_then(|n| n.as_str())
                    .or_else(|| {
                        conv.model_config
                            .get("modelName")
                            .and_then(|n| n.as_str())
                    })
                    .unwrap_or("unknown");
                let token_model = if raw_model == "default" {
                    "unknown"
                } else {
                    raw_model
                };

                normalized_token_usage.push(TokenUsageRecord {
                    id: generate_id(&[
                        &conversation_id,
                        &format!("token-{}", bubble.bubble_id),
                    ]),
                    conversation_id: conversation_id.clone(),
                    message_id: Some(msg_id),
                    model: token_model.to_string(),
                    input_tokens: 0,
                    output_tokens: estimated_output,
                    cache_read_tokens: 0,
                    cache_creation_tokens: 0,
                    created_at: derive_bubble_timestamp(bubble, conv),
                });
            }
        }

        // Always update cumulative tracker
        if let Some(cumulative) = bubble.token_count_up_until_here {
            prev_cumulative_tokens = cumulative;
        }
    }

    Some(NormalizedData {
        conversation,
        messages: normalized_messages,
        tool_calls: normalized_tool_calls,
        token_usage: normalized_token_usage,
        compaction_events: vec![],
    })
}

// ── Helpers ─────────────────────────────────────────────────────────────

fn strip_xml_tags(text: &str) -> String {
    let re = regex::Regex::new(r"<[^>]*>").unwrap();
    re.replace_all(text, "").trim().to_string()
}

fn truncate(text: &str, max_len: usize) -> String {
    if text.len() > max_len {
        text[..max_len].to_string()
    } else {
        text.to_string()
    }
}

/// Derive a conversation title from bubbles.
/// Three-pass strategy matching Node.js: skip patterns, XML strip, assistant fallback.
fn derive_title(bubbles: &[CursorBubble]) -> Option<String> {
    // First pass: first non-skippable user bubble text
    for bubble in bubbles {
        if bubble.bubble_type == 1 && !bubble.text.trim().is_empty() {
            if should_skip_for_title(&bubble.text) {
                continue;
            }
            return Some(truncate(&bubble.text, 100));
        }
    }

    // Second pass: strip XML from XML user bubbles, use first with >10 chars
    for bubble in bubbles {
        if bubble.bubble_type == 1 && bubble.text.trim().starts_with('<') {
            let stripped = strip_xml_tags(&bubble.text);
            if stripped.len() > 10 {
                return Some(truncate(&stripped, 100));
            }
        }
    }

    // Third pass: first assistant bubble with text
    for bubble in bubbles {
        if bubble.bubble_type == 2 && !bubble.text.trim().is_empty() {
            return Some(truncate(&bubble.text, 100));
        }
    }

    None
}

/// Derive conversation model from config or most common across bubbles.
fn derive_model(conv: &CursorConversation, bubbles: &[CursorBubble]) -> Option<String> {
    // Try modelConfig first, skip "default"
    if let Some(name) = conv.model_config.get("modelName").and_then(|n| n.as_str()) {
        if name != "default" {
            return Some(name.to_string());
        }
    }

    // Fall back to most common model across AI bubbles (skip "default")
    let mut models: HashMap<String, usize> = HashMap::new();
    for bubble in bubbles {
        if bubble.bubble_type == 2 {
            if let Some(name) = bubble
                .model_info
                .as_ref()
                .and_then(|m| m.get("modelName"))
                .and_then(|n| n.as_str())
            {
                if name != "default" {
                    *models.entry(name.to_string()).or_insert(0) += 1;
                }
            }
        }
    }

    let best = models
        .into_iter()
        .max_by_key(|(_, count)| *count)
        .map(|(model, _)| model);

    if best.is_none() {
        // If no real model found and config was "default", return "unknown"
        if conv
            .model_config
            .get("modelName")
            .and_then(|n| n.as_str())
            == Some("default")
        {
            return Some("unknown".to_string());
        }
    }

    best
}

/// Normalize a Cursor timestamp (f64, ms or seconds) to ISO 8601 string.
fn normalize_cursor_timestamp_f64(ts: f64) -> String {
    if ts == 0.0 {
        return chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    }

    let ms = if ts < 1e12 {
        (ts * 1000.0) as i64
    } else {
        ts as i64
    };

    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string())
}

/// Normalize a Cursor timestamp from a serde_json::Value (number or string) to ISO 8601.
fn normalize_cursor_timestamp_value(val: &Value) -> String {
    if val.is_null() {
        return chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
    }

    if let Some(n) = val.as_f64() {
        return normalize_cursor_timestamp_f64(n);
    }

    if let Some(s) = val.as_str() {
        // Try parsing as ISO string
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
            return dt.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string();
        }
        // Try parsing as a number string
        if let Ok(n) = s.parse::<f64>() {
            return normalize_cursor_timestamp_f64(n);
        }
    }

    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// Derive a bubble's timestamp, falling back through available sources.
fn derive_bubble_timestamp(bubble: &CursorBubble, conv: &CursorConversation) -> String {
    // 1. Try bubble's own createdAt
    if let Some(ref created_at) = bubble.created_at {
        return normalize_cursor_timestamp_value(created_at);
    }

    // 2. Try timingInfo.clientStartTime
    if let Some(ref timing) = bubble.timing_info {
        if let Some(start_time) = timing.get("clientStartTime").and_then(|v| v.as_f64()) {
            return normalize_cursor_timestamp_f64(start_time);
        }
    }

    // 3. Fall back to conversation createdAt
    normalize_cursor_timestamp_f64(conv.created_at)
}

/// Safely parse a JSON string, returning None if parsing fails or input is None.
fn safe_json_parse(value: Option<&str>) -> Option<Value> {
    value.and_then(|s| serde_json::from_str(s).ok())
}

/// Safely parse a JSON string, falling back to the raw string as a Value if not valid JSON.
fn safe_json_parse_with_fallback(value: Option<&str>) -> Option<Value> {
    match value {
        None => None,
        Some(s) => match serde_json::from_str(s) {
            Ok(v) => Some(v),
            Err(_) => Some(Value::String(s.to_string())),
        },
    }
}

/// Map Cursor toolFormerData.status to normalized status values.
fn map_tool_status(status: Option<&str>) -> Option<String> {
    match status {
        None => None,
        Some("completed") => Some("success".to_string()),
        Some("error") => Some("error".to_string()),
        Some(other) => Some(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_test_conv() -> CursorConversation {
        CursorConversation {
            composer_id: "test-conv-001".to_string(),
            name: Some("Test Conversation".to_string()),
            created_at: 1700000000000.0,
            last_updated_at: 1700001000000.0,
            status: Some("active".to_string()),
            is_agentic: true,
            usage_data: json!(null),
            model_config: json!({ "modelName": "claude-3-sonnet" }),
            full_conversation_headers_only: json!([]),
            workspace_path: Some("/Users/test/project".to_string()),
        }
    }

    fn make_user_bubble(id: &str, text: &str) -> CursorBubble {
        CursorBubble {
            bubble_id: id.to_string(),
            bubble_type: 1,
            text: text.to_string(),
            created_at: Some(json!("2024-01-01T10:00:00Z")),
            token_count: None,
            model_info: None,
            timing_info: None,
            tool_former_data: json!(null),
            is_capability_iteration: false,
            capability_type: None,
            token_count_up_until_here: None,
            thinking: None,
        }
    }

    fn make_assistant_bubble(id: &str, text: &str) -> CursorBubble {
        CursorBubble {
            bubble_id: id.to_string(),
            bubble_type: 2,
            text: text.to_string(),
            created_at: Some(json!("2024-01-01T10:00:01Z")),
            token_count: Some(json!({ "inputTokens": 50, "outputTokens": 100 })),
            model_info: Some(json!({ "modelName": "claude-3-sonnet" })),
            timing_info: None,
            tool_former_data: json!(null),
            is_capability_iteration: false,
            capability_type: None,
            token_count_up_until_here: Some(150.0),
            thinking: None,
        }
    }

    #[test]
    fn returns_none_for_empty_bubbles() {
        let conv = make_test_conv();
        let result = normalize_cursor_conversation(&conv, &[], "test-project");
        assert!(result.is_none());
    }

    #[test]
    fn basic_user_and_assistant_messages() {
        let conv = make_test_conv();
        let bubbles = vec![
            make_user_bubble("0", "Hello"),
            make_assistant_bubble("1", "Hi there"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "test-project").unwrap();

        assert_eq!(result.conversation.agent, "cursor");
        assert_eq!(
            result.conversation.project,
            Some("test-project".to_string())
        );
        assert_eq!(result.messages.len(), 2);
        assert_eq!(result.messages[0].role, "user");
        assert_eq!(result.messages[0].content, Some("Hello".to_string()));
        assert_eq!(result.messages[1].role, "assistant");
        assert_eq!(result.messages[1].content, Some("Hi there".to_string()));
    }

    #[test]
    fn conversation_id_deterministic() {
        let conv = make_test_conv();
        let bubbles = vec![make_user_bubble("0", "test")];
        let r1 = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();
        let r2 = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();
        assert_eq!(r1.conversation.id, r2.conversation.id);
    }

    #[test]
    fn consecutive_assistant_bubbles_merged() {
        let conv = make_test_conv();
        let bubbles = vec![
            make_user_bubble("0", "Question"),
            make_assistant_bubble("1", "Part one"),
            make_assistant_bubble("2", "Part two"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(result.messages.len(), 2);
        let asst = &result.messages[1];
        assert_eq!(asst.role, "assistant");
        assert!(asst.content.as_ref().unwrap().contains("Part one"));
        assert!(asst.content.as_ref().unwrap().contains("Part two"));
    }

    #[test]
    fn tool_only_bubbles_counted_in_prefix() {
        let conv = make_test_conv();
        let mut tool_bubble = make_assistant_bubble("1", "");
        tool_bubble.text = String::new();
        tool_bubble.capability_type = Some(json!(5));
        tool_bubble.tool_former_data = json!(null);

        let bubbles = vec![
            make_user_bubble("0", "Do something"),
            tool_bubble,
            make_assistant_bubble("2", "Done"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        let asst = &result.messages[1];
        assert!(asst
            .content
            .as_ref()
            .unwrap()
            .contains("Executed 1 tool call"));
    }

    #[test]
    fn tool_calls_extracted_from_tool_former_data() {
        let conv = make_test_conv();
        let mut tool_bubble = make_assistant_bubble("1", "");
        tool_bubble.text = String::new();
        tool_bubble.capability_type = Some(json!(5));
        tool_bubble.tool_former_data = json!({
            "name": "Read",
            "status": "completed",
            "params": "{\"path\": \"test.rs\"}",
            "result": "{\"content\": \"file contents\"}",
            "toolCallId": "tc-001"
        });

        let bubbles = vec![
            make_user_bubble("0", "Read a file"),
            tool_bubble,
            make_assistant_bubble("2", "Here is the file"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(result.tool_calls.len(), 1);
        assert_eq!(result.tool_calls[0].name, "Read");
        assert_eq!(result.tool_calls[0].status, Some("success".to_string()));
    }

    #[test]
    fn thinking_segments_merged() {
        let conv = make_test_conv();
        let mut b1 = make_assistant_bubble("1", "Response");
        b1.thinking = Some(json!({ "text": "Thinking part 1" }));

        let mut b2 = make_assistant_bubble("2", "More");
        b2.thinking = Some(json!({ "text": "Thinking part 2" }));

        let bubbles = vec![make_user_bubble("0", "Question"), b1, b2];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        let asst = &result.messages[1];
        assert!(asst.thinking.is_some());
        let thinking = asst.thinking.as_ref().unwrap();
        assert!(thinking.contains("Thinking part 1"));
        assert!(thinking.contains("Thinking part 2"));
    }

    #[test]
    fn token_usage_from_per_bubble_counts() {
        let conv = make_test_conv();
        let bubbles = vec![
            make_user_bubble("0", "Hi"),
            make_assistant_bubble("1", "Hello"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(result.token_usage.len(), 1);
        assert_eq!(result.token_usage[0].input_tokens, 50);
        assert_eq!(result.token_usage[0].output_tokens, 100);
    }

    #[test]
    fn token_usage_cumulative_differential() {
        let conv = make_test_conv();
        let mut b1 = make_assistant_bubble("1", "First");
        b1.token_count = None;
        b1.token_count_up_until_here = Some(100.0);

        let mut b2 = make_assistant_bubble("2", "Second");
        b2.token_count = None;
        b2.token_count_up_until_here = Some(250.0);

        let bubbles = vec![make_user_bubble("0", "Question"), b1, b2];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(result.token_usage.len(), 2);
        assert_eq!(result.token_usage[0].output_tokens, 100);
        assert_eq!(result.token_usage[1].output_tokens, 150);
    }

    #[test]
    fn timestamp_normalization() {
        let conv = make_test_conv();
        let bubbles = vec![make_user_bubble("0", "Hello")];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert!(result.conversation.created_at.contains("T"));
        assert!(
            result.conversation.created_at.contains("Z")
                || result.conversation.created_at.contains("+")
        );
    }

    #[test]
    fn model_derived_from_config() {
        let conv = make_test_conv();
        let bubbles = vec![
            make_user_bubble("0", "Hi"),
            make_assistant_bubble("1", "Hello"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(
            result.conversation.model,
            Some("claude-3-sonnet".to_string())
        );
    }

    #[test]
    fn default_model_mapped_to_unknown() {
        let mut conv = make_test_conv();
        conv.model_config = json!({ "modelName": "default" });

        let mut b = make_assistant_bubble("1", "Hello");
        b.model_info = Some(json!({ "modelName": "default" }));

        let bubbles = vec![make_user_bubble("0", "Hi"), b];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(result.conversation.model, Some("unknown".to_string()));
    }

    #[test]
    fn no_compaction_events() {
        let conv = make_test_conv();
        let bubbles = vec![make_user_bubble("0", "Hello")];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();
        assert!(result.compaction_events.is_empty());
    }

    #[test]
    fn title_derived_from_first_non_skip_user() {
        let conv = make_test_conv();
        let bubbles = vec![
            make_user_bubble("0", "/command"),
            make_user_bubble("1", "Actual question here"),
            make_assistant_bubble("2", "Response"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(
            result.conversation.title,
            Some("Actual question here".to_string())
        );
    }

    #[test]
    fn tool_status_mapping() {
        let conv = make_test_conv();

        let mut tool_completed = make_assistant_bubble("1", "");
        tool_completed.text = String::new();
        tool_completed.capability_type = Some(json!(5));
        tool_completed.tool_former_data = json!({
            "name": "Write",
            "status": "completed",
            "params": "{}",
        });

        let mut tool_error = make_assistant_bubble("2", "");
        tool_error.text = String::new();
        tool_error.capability_type = Some(json!(5));
        tool_error.tool_former_data = json!({
            "name": "Read",
            "status": "error",
            "params": "{}",
        });

        let bubbles = vec![
            make_user_bubble("0", "Do things"),
            tool_completed,
            tool_error,
            make_assistant_bubble("3", "Done"),
        ];
        let result = normalize_cursor_conversation(&conv, &bubbles, "p").unwrap();

        assert_eq!(result.tool_calls[0].status, Some("success".to_string()));
        assert_eq!(result.tool_calls[1].status, Some("error".to_string()));
    }
}
