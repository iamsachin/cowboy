use std::collections::HashMap;
use tokio::fs::File;
use tokio::io::{AsyncBufReadExt, AsyncSeekExt, BufReader};

use super::types::{
    AssistantMessageData, CompactionEventData, ContentBlock, ParseResult, TokenUsageRaw,
    ToolResultData, ToolUseBlock, UserMessageData,
};

// ── Internal chunk accumulator ──────────────────────────────────────────

struct ChunkAccumulator {
    first_uuid: String,
    message_id: String,
    earliest_timestamp: String,
    model: String,
    content_blocks: Vec<ContentBlock>,
    tool_use_blocks: Vec<ToolUseBlock>,
    final_usage: Option<TokenUsageRaw>,
    stop_reason: String,
}

// ── Main parser ─────────────────────────────────────────────────────────

/// Parse a Claude Code JSONL file line-by-line using streaming I/O.
/// Reconstructs multi-chunk assistant messages into single messages,
/// extracting token usage from the final chunk only.
///
/// When `from_offset > 0`, seeks to that byte position before reading,
/// enabling incremental parsing of append-only JSONL files.
/// Returns the parse result and the byte offset at end of file.
pub async fn parse_jsonl_file(
    file_path: &str,
) -> Result<ParseResult, Box<dyn std::error::Error + Send + Sync>> {
    let (result, _offset) = parse_jsonl_file_incremental(file_path, 0).await?;
    Ok(result)
}

/// Incremental variant: parses from `from_offset` bytes into the file.
/// Returns `(ParseResult, new_offset)` where `new_offset` is the byte position
/// at end of file, suitable for passing as `from_offset` on the next call.
pub async fn parse_jsonl_file_incremental(
    file_path: &str,
    from_offset: u64,
) -> Result<(ParseResult, u64), Box<dyn std::error::Error + Send + Sync>> {
    let mut result = ParseResult {
        session_id: None,
        user_messages: Vec::new(),
        assistant_messages: Vec::new(),
        compaction_events: Vec::new(),
        skipped_lines: 0,
        timestamps: Vec::new(),
    };

    let mut file = File::open(file_path).await?;

    // Seek to the stored offset for incremental parsing
    if from_offset > 0 {
        file.seek(std::io::SeekFrom::Start(from_offset)).await?;
    }

    let reader = BufReader::new(file);
    let mut lines = reader.lines();

    // Map of message.id -> accumulated chunks for assistant reconstruction
    let mut chunk_map: HashMap<String, ChunkAccumulator> = HashMap::new();

    while let Some(line) = lines.next_line().await? {
        // Skip empty lines
        if line.trim().is_empty() {
            result.skipped_lines += 1;
            continue;
        }

        // Try to parse JSON
        let parsed: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => {
                result.skipped_lines += 1;
                continue;
            }
        };

        let line_type = match parsed.get("type").and_then(|v| v.as_str()) {
            Some(t) => t.to_string(),
            None => {
                result.skipped_lines += 1;
                continue;
            }
        };

        // Skip lines that are not user or assistant
        if line_type != "user" && line_type != "assistant" {
            result.skipped_lines += 1;
            continue;
        }

        let uuid = parsed
            .get("uuid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let session_id = parsed
            .get("sessionId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let timestamp = parsed
            .get("timestamp")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Capture sessionId from first line that has it
        if result.session_id.is_none() {
            if let Some(ref sid) = session_id {
                result.session_id = Some(sid.clone());
            }
        }

        // Record timestamp
        result.timestamps.push(timestamp.clone());

        let message = parsed.get("message");

        if line_type == "user" {
            // Detect compaction summary before normal user processing
            let is_compact = parsed
                .get("isCompactSummary")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            if is_compact {
                let summary_content = message
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string());
                result.compaction_events.push(CompactionEventData {
                    uuid: uuid.clone(),
                    timestamp: timestamp.clone(),
                    summary: summary_content,
                });
            }

            process_user_line(&mut result, &uuid, &timestamp, message);
        } else if line_type == "assistant" {
            process_assistant_chunk(&mut chunk_map, &uuid, &timestamp, message);
        }
    }

    // Reconstruct assistant messages from accumulated chunks
    reconstruct_assistant_messages(&mut result, chunk_map);

    // Get final file position for next incremental call
    let end_offset = tokio::fs::metadata(file_path).await?.len();

    Ok((result, end_offset))
}

/// Parse JSONL content from a string (for testing).
pub fn parse_jsonl_content(
    content: &str,
) -> Result<ParseResult, Box<dyn std::error::Error + Send + Sync>> {
    let mut result = ParseResult {
        session_id: None,
        user_messages: Vec::new(),
        assistant_messages: Vec::new(),
        compaction_events: Vec::new(),
        skipped_lines: 0,
        timestamps: Vec::new(),
    };

    let mut chunk_map: HashMap<String, ChunkAccumulator> = HashMap::new();

    for line in content.lines() {
        if line.trim().is_empty() {
            result.skipped_lines += 1;
            continue;
        }

        let parsed: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => {
                result.skipped_lines += 1;
                continue;
            }
        };

        let line_type = match parsed.get("type").and_then(|v| v.as_str()) {
            Some(t) => t.to_string(),
            None => {
                result.skipped_lines += 1;
                continue;
            }
        };

        if line_type != "user" && line_type != "assistant" {
            result.skipped_lines += 1;
            continue;
        }

        let uuid = parsed
            .get("uuid")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let session_id = parsed
            .get("sessionId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let timestamp = parsed
            .get("timestamp")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if result.session_id.is_none() {
            if let Some(ref sid) = session_id {
                result.session_id = Some(sid.clone());
            }
        }

        result.timestamps.push(timestamp.clone());

        let message = parsed.get("message");

        if line_type == "user" {
            let is_compact = parsed
                .get("isCompactSummary")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            if is_compact {
                let summary_content = message
                    .and_then(|m| m.get("content"))
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string());
                result.compaction_events.push(CompactionEventData {
                    uuid: uuid.clone(),
                    timestamp: timestamp.clone(),
                    summary: summary_content,
                });
            }

            process_user_line(&mut result, &uuid, &timestamp, message);
        } else if line_type == "assistant" {
            process_assistant_chunk(&mut chunk_map, &uuid, &timestamp, message);
        }
    }

    reconstruct_assistant_messages(&mut result, chunk_map);

    Ok(result)
}

// ── User line processing ────────────────────────────────────────────────

fn process_user_line(
    result: &mut ParseResult,
    uuid: &str,
    timestamp: &str,
    message: Option<&serde_json::Value>,
) {
    let mut user_data = UserMessageData {
        uuid: uuid.to_string(),
        timestamp: timestamp.to_string(),
        content: None,
        tool_results: Vec::new(),
    };

    if let Some(msg) = message {
        if let Some(content) = msg.get("content") {
            if let Some(text) = content.as_str() {
                user_data.content = Some(text.to_string());
            } else if let Some(blocks) = content.as_array() {
                let mut text_parts: Vec<String> = Vec::new();

                for block in blocks {
                    let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");

                    if block_type == "text" {
                        if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                            text_parts.push(text.to_string());
                        }
                    } else if block_type == "tool_result" {
                        let tool_use_id = block
                            .get("tool_use_id")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let content_str = extract_tool_result_content(block.get("content"));
                        let is_error = block
                            .get("is_error")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);

                        user_data.tool_results.push(ToolResultData {
                            tool_use_id,
                            content: content_str,
                            is_error,
                        });
                    }
                }

                if !text_parts.is_empty() {
                    user_data.content = Some(text_parts.join(""));
                }
            }
        }
    }

    result.user_messages.push(user_data);
}

fn extract_tool_result_content(content: Option<&serde_json::Value>) -> String {
    match content {
        Some(v) if v.is_string() => v.as_str().unwrap_or("").to_string(),
        Some(v) if v.is_array() => {
            let blocks = v.as_array().unwrap();
            blocks
                .iter()
                .filter(|b| b.get("type").and_then(|t| t.as_str()) == Some("text"))
                .filter_map(|b| b.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("")
        }
        _ => String::new(),
    }
}

// ── Assistant chunk processing ──────────────────────────────────────────

fn process_assistant_chunk(
    chunk_map: &mut HashMap<String, ChunkAccumulator>,
    uuid: &str,
    timestamp: &str,
    message: Option<&serde_json::Value>,
) {
    let msg = match message {
        Some(m) => m,
        None => return,
    };

    let message_id = match msg.get("id").and_then(|v| v.as_str()) {
        Some(id) => id.to_string(),
        None => return,
    };

    let model = msg
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let mut content_blocks = Vec::new();
    let mut tool_use_blocks = Vec::new();

    if let Some(blocks) = msg.get("content").and_then(|c| c.as_array()) {
        for block in blocks {
            let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");

            match block_type {
                "text" => {
                    let text = block
                        .get("text")
                        .and_then(|t| t.as_str())
                        .unwrap_or("")
                        .to_string();
                    content_blocks.push(ContentBlock::Text { text });
                }
                "thinking" => {
                    let thinking = block
                        .get("thinking")
                        .and_then(|t| t.as_str())
                        .unwrap_or("")
                        .to_string();
                    content_blocks.push(ContentBlock::Thinking { thinking });
                }
                "tool_use" => {
                    let id = block
                        .get("id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let name = block
                        .get("name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let input = block
                        .get("input")
                        .cloned()
                        .unwrap_or(serde_json::Value::Null);

                    content_blocks.push(ContentBlock::ToolUse {
                        id: id.clone(),
                        name: name.clone(),
                        input: input.clone(),
                    });
                    tool_use_blocks.push(ToolUseBlock { id, name, input });
                }
                "tool_result" => {
                    let tool_use_id = block
                        .get("tool_use_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let content = block
                        .get("content")
                        .cloned()
                        .unwrap_or(serde_json::Value::Null);
                    let is_error = block.get("is_error").and_then(|v| v.as_bool());

                    content_blocks.push(ContentBlock::ToolResult {
                        tool_use_id,
                        content,
                        is_error,
                    });
                }
                _ => {
                    // Unknown block type, still include as text if possible
                }
            }
        }
    }

    let accumulator = chunk_map.entry(message_id.clone()).or_insert_with(|| {
        ChunkAccumulator {
            first_uuid: uuid.to_string(),
            message_id: message_id.clone(),
            earliest_timestamp: timestamp.to_string(),
            model: model.clone(),
            content_blocks: Vec::new(),
            tool_use_blocks: Vec::new(),
            final_usage: None,
            stop_reason: String::new(),
        }
    });

    // Each streaming chunk contains the FULL content up to that point (cumulative, not delta).
    // Replace, don't append -- the last chunk has the complete content.
    if !content_blocks.is_empty() {
        accumulator.content_blocks = content_blocks;
    }
    if !tool_use_blocks.is_empty() {
        accumulator.tool_use_blocks = tool_use_blocks;
    }

    // Track earliest timestamp
    if timestamp < accumulator.earliest_timestamp.as_str() {
        accumulator.earliest_timestamp = timestamp.to_string();
    }

    // Only capture usage from the FINAL chunk (non-null stop_reason)
    let stop_reason = msg.get("stop_reason");
    let has_stop = stop_reason.is_some() && !stop_reason.unwrap().is_null();

    if has_stop {
        let usage = msg
            .get("usage")
            .and_then(|u| serde_json::from_value::<TokenUsageRaw>(u.clone()).ok());
        accumulator.final_usage = usage;
        accumulator.stop_reason = stop_reason
            .and_then(|s| s.as_str())
            .unwrap_or("")
            .to_string();
    }
}

// ── Reconstruction ──────────────────────────────────────────────────────

fn reconstruct_assistant_messages(
    result: &mut ParseResult,
    chunk_map: HashMap<String, ChunkAccumulator>,
) {
    // Collect and sort by earliest timestamp for deterministic ordering
    let mut accumulators: Vec<ChunkAccumulator> = chunk_map.into_values().collect();
    accumulators.sort_by(|a, b| a.earliest_timestamp.cmp(&b.earliest_timestamp));

    for acc in accumulators {
        result.assistant_messages.push(AssistantMessageData {
            first_uuid: acc.first_uuid,
            message_id: acc.message_id,
            timestamp: acc.earliest_timestamp,
            model: acc.model,
            content_blocks: acc.content_blocks,
            tool_use_blocks: acc.tool_use_blocks,
            usage: acc.final_usage,
            stop_reason: acc.stop_reason,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_test_jsonl() -> String {
        let lines = vec![
            // User message with simple text
            r#"{"type":"user","uuid":"u1","sessionId":"sess-001","timestamp":"2024-01-01T10:00:00Z","message":{"role":"user","content":"Hello, help me write code"}}"#,
            // Assistant chunk 1 (partial)
            r#"{"type":"assistant","uuid":"a1","sessionId":"sess-001","timestamp":"2024-01-01T10:00:01Z","message":{"role":"assistant","id":"msg-001","model":"claude-3-opus","content":[{"type":"text","text":"Sure, I"}],"stop_reason":null}}"#,
            // Assistant chunk 2 (final, cumulative replacement)
            r#"{"type":"assistant","uuid":"a2","sessionId":"sess-001","timestamp":"2024-01-01T10:00:02Z","message":{"role":"assistant","id":"msg-001","model":"claude-3-opus","content":[{"type":"thinking","thinking":"Let me think about this"},{"type":"text","text":"Sure, I can help you write code."},{"type":"tool_use","id":"tu-001","name":"Write","input":{"path":"test.rs","content":"fn main() {}"}}],"stop_reason":"end_turn","usage":{"input_tokens":100,"output_tokens":50,"cache_read_input_tokens":20}}}"#,
            // User message with tool result
            r#"{"type":"user","uuid":"u2","sessionId":"sess-001","timestamp":"2024-01-01T10:00:03Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu-001","content":"File written successfully","is_error":false},{"type":"text","text":"Thanks!"}]}}"#,
            // Progress line (should be skipped)
            r#"{"type":"progress","uuid":"p1","sessionId":"sess-001","timestamp":"2024-01-01T10:00:04Z"}"#,
            // Second assistant message
            r#"{"type":"assistant","uuid":"a3","sessionId":"sess-001","timestamp":"2024-01-01T10:00:05Z","message":{"role":"assistant","id":"msg-002","model":"claude-3-opus","content":[{"type":"text","text":"You're welcome!"}],"stop_reason":"end_turn","usage":{"input_tokens":150,"output_tokens":30}}}"#,
        ];
        lines.join("\n")
    }

    #[test]
    fn parse_basic_jsonl() {
        let content = make_test_jsonl();
        let result = parse_jsonl_content(&content).unwrap();

        // Should capture session ID
        assert_eq!(result.session_id, Some("sess-001".to_string()));

        // 2 user messages
        assert_eq!(result.user_messages.len(), 2);

        // First user message has simple text content
        assert_eq!(
            result.user_messages[0].content,
            Some("Hello, help me write code".to_string())
        );

        // Second user message has text from mixed content
        assert_eq!(
            result.user_messages[1].content,
            Some("Thanks!".to_string())
        );

        // Second user message has tool result
        assert_eq!(result.user_messages[1].tool_results.len(), 1);
        assert_eq!(result.user_messages[1].tool_results[0].tool_use_id, "tu-001");
        assert_eq!(
            result.user_messages[1].tool_results[0].content,
            "File written successfully"
        );
        assert!(!result.user_messages[1].tool_results[0].is_error);

        // 2 assistant messages (2 chunks for msg-001 should be accumulated into 1)
        assert_eq!(result.assistant_messages.len(), 2);

        // First assistant message should have cumulative content (from final chunk)
        let first_asst = &result.assistant_messages[0];
        assert_eq!(first_asst.message_id, "msg-001");
        assert_eq!(first_asst.first_uuid, "a1");
        assert_eq!(first_asst.model, "claude-3-opus");
        // Content blocks from final chunk: thinking + text + tool_use = 3 blocks
        assert_eq!(first_asst.content_blocks.len(), 3);
        assert_eq!(first_asst.tool_use_blocks.len(), 1);
        assert_eq!(first_asst.stop_reason, "end_turn");
        assert!(first_asst.usage.is_some());

        let usage = first_asst.usage.as_ref().unwrap();
        assert_eq!(usage.input_tokens, 100);
        assert_eq!(usage.output_tokens, 50);
        assert_eq!(usage.cache_read_input_tokens, Some(20));

        // Second assistant message
        let second_asst = &result.assistant_messages[1];
        assert_eq!(second_asst.message_id, "msg-002");

        // 1 skipped line (progress)
        assert_eq!(result.skipped_lines, 1);

        // 6 lines total, so 6 timestamps (but progress is skipped so 5 timestamps)
        assert_eq!(result.timestamps.len(), 5);
    }

    #[test]
    fn multi_chunk_cumulative_replacement() {
        let lines = vec![
            r#"{"type":"assistant","uuid":"a1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","message":{"role":"assistant","id":"m1","model":"claude-3","content":[{"type":"text","text":"Hel"}],"stop_reason":null}}"#,
            r#"{"type":"assistant","uuid":"a2","sessionId":"s1","timestamp":"2024-01-01T10:00:01Z","message":{"role":"assistant","id":"m1","model":"claude-3","content":[{"type":"text","text":"Hello wor"}],"stop_reason":null}}"#,
            r#"{"type":"assistant","uuid":"a3","sessionId":"s1","timestamp":"2024-01-01T10:00:02Z","message":{"role":"assistant","id":"m1","model":"claude-3","content":[{"type":"text","text":"Hello world!"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}}}"#,
        ];
        let content = lines.join("\n");
        let result = parse_jsonl_content(&content).unwrap();

        assert_eq!(result.assistant_messages.len(), 1);
        let msg = &result.assistant_messages[0];
        // Should have the final cumulative content, not concatenation
        match &msg.content_blocks[0] {
            ContentBlock::Text { text } => assert_eq!(text, "Hello world!"),
            _ => panic!("Expected text block"),
        }
        assert_eq!(msg.first_uuid, "a1");
        assert_eq!(msg.timestamp, "2024-01-01T10:00:00Z"); // earliest
        assert!(msg.usage.is_some()); // from final chunk only
    }

    #[test]
    fn compaction_event_detected() {
        let lines = vec![
            r#"{"type":"user","uuid":"c1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","isCompactSummary":true,"message":{"role":"user","content":"This session is being continued from a previous conversation.\n\nActual summary content here."}}"#,
        ];
        let content = lines.join("\n");
        let result = parse_jsonl_content(&content).unwrap();

        assert_eq!(result.compaction_events.len(), 1);
        assert_eq!(result.compaction_events[0].uuid, "c1");
        assert!(result.compaction_events[0].summary.is_some());
        // Should also be added as a user message
        assert_eq!(result.user_messages.len(), 1);
    }

    #[test]
    fn tool_result_content_concatenation() {
        let lines = vec![
            r#"{"type":"user","uuid":"u1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"tu1","content":"First part","is_error":false},{"type":"tool_result","tool_use_id":"tu1","content":"Second part","is_error":false}]}}"#,
        ];
        let content = lines.join("\n");
        let result = parse_jsonl_content(&content).unwrap();

        // Both tool results with same toolUseId captured
        assert_eq!(result.user_messages[0].tool_results.len(), 2);
        assert_eq!(result.user_messages[0].tool_results[0].content, "First part");
        assert_eq!(result.user_messages[0].tool_results[1].content, "Second part");
    }

    #[test]
    fn empty_and_invalid_lines_skipped() {
        let content = "\n\nnot json\n{\"no_type\":true}\n";
        let result = parse_jsonl_content(content).unwrap();
        assert_eq!(result.skipped_lines, 4); // 2 empty + 1 invalid json + 1 no type
        assert_eq!(result.user_messages.len(), 0);
        assert_eq!(result.assistant_messages.len(), 0);
    }

    #[test]
    fn usage_only_from_final_chunk() {
        let lines = vec![
            r#"{"type":"assistant","uuid":"a1","sessionId":"s1","timestamp":"2024-01-01T10:00:00Z","message":{"role":"assistant","id":"m1","model":"claude-3","content":[{"type":"text","text":"partial"}],"stop_reason":null,"usage":{"input_tokens":999,"output_tokens":999}}}"#,
            r#"{"type":"assistant","uuid":"a2","sessionId":"s1","timestamp":"2024-01-01T10:00:01Z","message":{"role":"assistant","id":"m1","model":"claude-3","content":[{"type":"text","text":"complete"}],"stop_reason":"end_turn","usage":{"input_tokens":10,"output_tokens":5}}}"#,
        ];
        let content = lines.join("\n");
        let result = parse_jsonl_content(&content).unwrap();

        let msg = &result.assistant_messages[0];
        let usage = msg.usage.as_ref().unwrap();
        // Should have usage from the FINAL chunk (stop_reason != null)
        assert_eq!(usage.input_tokens, 10);
        assert_eq!(usage.output_tokens, 5);
    }
}
