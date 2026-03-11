use serde::{Deserialize, Serialize};

// ── Content blocks ──────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "thinking")]
    Thinking { thinking: String },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        content: serde_json::Value, // String or array of ContentBlock
        #[serde(default)]
        is_error: Option<bool>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenUsageRaw {
    pub input_tokens: i64,
    pub output_tokens: i64,
    #[serde(default)]
    pub cache_read_input_tokens: Option<i64>,
    #[serde(default)]
    pub cache_creation_input_tokens: Option<i64>,
}

// ── Parser output types ─────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ToolResultData {
    pub tool_use_id: String,
    pub content: String,
    pub is_error: bool,
}

#[derive(Debug, Clone)]
pub struct UserMessageData {
    pub uuid: String,
    pub timestamp: String,
    pub content: Option<String>,
    pub tool_results: Vec<ToolResultData>,
}

#[derive(Debug, Clone)]
pub struct AssistantMessageData {
    pub first_uuid: String,
    pub message_id: String,
    pub timestamp: String,
    pub model: String,
    pub content_blocks: Vec<ContentBlock>,
    pub tool_use_blocks: Vec<ToolUseBlock>,
    pub usage: Option<TokenUsageRaw>,
    pub stop_reason: String,
}

#[derive(Debug, Clone)]
pub struct ToolUseBlock {
    pub id: String,
    pub name: String,
    pub input: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct CompactionEventData {
    pub uuid: String,
    pub timestamp: String,
    pub summary: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParseResult {
    pub session_id: Option<String>,
    pub user_messages: Vec<UserMessageData>,
    pub assistant_messages: Vec<AssistantMessageData>,
    pub compaction_events: Vec<CompactionEventData>,
    pub skipped_lines: usize,
    pub timestamps: Vec<String>,
}

// ── Normalizer output types ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct ConversationRecord {
    pub id: String,
    pub agent: String,
    pub project: Option<String>,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MessageRecord {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: Option<String>,
    pub thinking: Option<String>,
    pub created_at: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolCallRecord {
    pub id: String,
    pub message_id: String,
    pub conversation_id: String,
    pub name: String,
    pub input: serde_json::Value,
    pub output: Option<String>,
    pub status: Option<String>,
    pub duration: Option<f64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TokenUsageRecord {
    pub id: String,
    pub conversation_id: String,
    pub message_id: Option<String>,
    pub model: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_creation_tokens: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CompactionEventRecord {
    pub id: String,
    pub conversation_id: String,
    pub timestamp: String,
    pub summary: Option<String>,
    pub tokens_before: Option<i64>,
    pub tokens_after: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct NormalizedData {
    pub conversation: ConversationRecord,
    pub messages: Vec<MessageRecord>,
    pub tool_calls: Vec<ToolCallRecord>,
    pub token_usage: Vec<TokenUsageRecord>,
    pub compaction_events: Vec<CompactionEventRecord>,
}

// ── File discovery types ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DiscoveredFile {
    pub file_path: String,
    pub project_dir: String,
    pub is_subagent: bool,
    pub session_id: String,
    pub parent_session_id: Option<String>,
}

// ── Ingestion status types ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestionStats {
    pub files_scanned: usize,
    pub files_skipped: usize,
    pub conversations_found: usize,
    pub messages_parsed: usize,
    pub tool_calls_extracted: usize,
    pub tokens_recorded: usize,
    pub skipped_lines: usize,
    pub duration: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestionProgress {
    pub files_processed: usize,
    pub total_files: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestionLastRun {
    pub completed_at: String,
    pub stats: IngestionStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IngestionStatus {
    pub running: bool,
    pub progress: Option<IngestionProgress>,
    pub last_run: Option<IngestionLastRun>,
}
