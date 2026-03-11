use serde_json::Value;
use tokio_rusqlite::rusqlite::{self, Connection, OpenFlags};

// ── Types ──────────────────────────────────────────────────────────────

/// Cursor conversation metadata extracted from composerData entries.
#[derive(Debug, Clone)]
pub struct CursorConversation {
    pub composer_id: String,
    pub name: Option<String>,
    pub created_at: f64,
    pub last_updated_at: f64,
    pub status: Option<String>,
    pub is_agentic: bool,
    pub usage_data: Value,
    pub model_config: Value,
    pub full_conversation_headers_only: Value,
    pub workspace_path: Option<String>,
}

/// A single bubble (message unit) from a Cursor conversation.
#[derive(Debug, Clone)]
pub struct CursorBubble {
    pub bubble_id: String,
    pub bubble_type: u32,
    pub text: String,
    pub created_at: Option<Value>,
    pub token_count: Option<Value>,
    pub model_info: Option<Value>,
    pub timing_info: Option<Value>,
    pub tool_former_data: Value,
    pub is_capability_iteration: bool,
    pub capability_type: Option<Value>,
    pub token_count_up_until_here: Option<f64>,
    pub thinking: Option<Value>,
}

// ── Parser functions ────────────────────────────────────────────────────

/// Parse Cursor state.vscdb for conversation metadata.
/// Opens the database readonly to avoid corrupting Cursor's active database.
///
/// Queries cursorDiskKV for composerData:* entries which contain
/// conversation-level metadata (name, timestamps, model config, usage data).
pub fn parse_cursor_db(db_path: &str) -> Result<Vec<CursorConversation>, String> {
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open Cursor DB: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT key, CAST(value AS TEXT) as value FROM cursorDiskKV WHERE key LIKE 'composerData:%' AND LENGTH(value) > 100",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut conversations = Vec::new();

    let rows = stmt
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        })
        .map_err(|e| format!("Failed to query: {}", e))?;

    for row_result in rows {
        let (key, value) = match row_result {
            Ok(r) => r,
            Err(_) => continue,
        };

        let data: Value = match serde_json::from_str(&value) {
            Ok(v) => v,
            Err(_) => continue, // Skip rows with invalid JSON
        };

        let composer_id = key.replace("composerData:", "");

        let now_ms = chrono::Utc::now().timestamp_millis() as f64;

        let created_at = data
            .get("createdAt")
            .and_then(|v| v.as_f64())
            .unwrap_or(now_ms);
        let last_updated_at = data
            .get("lastUpdatedAt")
            .and_then(|v| v.as_f64())
            .or_else(|| data.get("createdAt").and_then(|v| v.as_f64()))
            .unwrap_or(now_ms);

        let name = data.get("name").and_then(|v| v.as_str()).map(String::from);
        let status = data
            .get("status")
            .and_then(|v| v.as_str())
            .map(String::from);
        let is_agentic = data
            .get("isAgentic")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let usage_data = data.get("usageData").cloned().unwrap_or(Value::Null);
        let model_config = data.get("modelConfig").cloned().unwrap_or(Value::Null);
        let full_conversation_headers_only = data
            .get("fullConversationHeadersOnly")
            .cloned()
            .unwrap_or(Value::Array(vec![]));

        // workspacePath fallback chain: workspacePath > workspaceFolder > rootDir > context.workspacePath
        let workspace_path = data
            .get("workspacePath")
            .and_then(|v| v.as_str())
            .or_else(|| data.get("workspaceFolder").and_then(|v| v.as_str()))
            .or_else(|| data.get("rootDir").and_then(|v| v.as_str()))
            .or_else(|| {
                data.get("context")
                    .and_then(|c| c.get("workspacePath"))
                    .and_then(|v| v.as_str())
            })
            .map(String::from);

        conversations.push(CursorConversation {
            composer_id,
            name,
            created_at,
            last_updated_at,
            status,
            is_agentic,
            usage_data,
            model_config,
            full_conversation_headers_only,
            workspace_path,
        });
    }

    Ok(conversations)
}

/// Get all bubbles (messages) for a specific Cursor conversation.
/// Bubbles are ordered by rowid (insertion order) which preserves chronological order.
pub fn get_bubbles_for_conversation(
    db_path: &str,
    composer_id: &str,
) -> Result<Vec<CursorBubble>, String> {
    let conn = Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("Failed to open Cursor DB: {}", e))?;

    let pattern = format!("bubbleId:{}:%", composer_id);

    let mut stmt = conn
        .prepare(
            "SELECT key, CAST(value AS TEXT) as value FROM cursorDiskKV WHERE key LIKE ?1 ORDER BY rowid ASC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let mut bubbles = Vec::new();

    let rows = stmt
        .query_map(rusqlite::params![pattern], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        })
        .map_err(|e| format!("Failed to query: {}", e))?;

    for row_result in rows {
        let (key, value) = match row_result {
            Ok(r) => r,
            Err(_) => continue,
        };

        let data: Value = match serde_json::from_str(&value) {
            Ok(v) => v,
            Err(_) => continue, // Skip rows with invalid JSON
        };

        // Extract bubbleId from key pattern: bubbleId:{composerId}:{bubbleId}
        let key_parts: Vec<&str> = key.split(':').collect();
        let bubble_id = key_parts.last().unwrap_or(&"").to_string();

        let bubble_type = data
            .get("type")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as u32;
        let text = data
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let created_at = data.get("createdAt").cloned().filter(|v| !v.is_null());
        let token_count = data.get("tokenCount").cloned().filter(|v| !v.is_null());
        let model_info = data.get("modelInfo").cloned().filter(|v| !v.is_null());
        let timing_info = data.get("timingInfo").cloned().filter(|v| !v.is_null());
        let tool_former_data = data
            .get("toolFormerData")
            .cloned()
            .unwrap_or(Value::Null);
        let is_capability_iteration = data
            .get("isCapabilityIteration")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let capability_type = data
            .get("capabilityType")
            .cloned()
            .filter(|v| !v.is_null());
        let token_count_up_until_here = data
            .get("tokenCountUpUntilHere")
            .and_then(|v| v.as_f64());
        let thinking = data.get("thinking").cloned().filter(|v| !v.is_null());

        bubbles.push(CursorBubble {
            bubble_id,
            bubble_type,
            text,
            created_at,
            token_count,
            model_info,
            timing_info,
            tool_former_data,
            is_capability_iteration,
            capability_type,
            token_count_up_until_here,
            thinking,
        });
    }

    Ok(bubbles)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create a temporary SQLite DB with cursorDiskKV table and test data
    fn create_test_vscdb() -> (tempfile::NamedTempFile, String) {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_string_lossy().to_string();

        // Use rusqlite directly to create the test DB
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB);",
        )
        .unwrap();

        // Insert a valid composerData entry
        let composer_data = serde_json::json!({
            "name": "Test Conversation",
            "createdAt": 1700000000000.0_f64,
            "lastUpdatedAt": 1700001000000.0_f64,
            "status": "active",
            "isAgentic": true,
            "usageData": null,
            "modelConfig": { "modelName": "claude-3-sonnet" },
            "fullConversationHeadersOnly": [],
            "workspacePath": "/Users/test/project"
        });

        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params![
                "composerData:test-composer-123",
                composer_data.to_string()
            ],
        )
        .unwrap();

        // Insert a short entry that should be filtered by LENGTH > 100
        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["composerData:short", "{}"],
        )
        .unwrap();

        // Insert an invalid JSON entry (padded to be > 100 chars)
        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["composerData:invalid", &"x".repeat(200)],
        )
        .unwrap();

        // Insert bubble data for the test conversation
        let bubble1 = serde_json::json!({
            "type": 1,
            "text": "Hello, help me with code",
            "createdAt": "2024-01-01T10:00:00Z",
            "tokenCount": null,
            "modelInfo": null,
            "timingInfo": null,
            "toolFormerData": null,
            "isCapabilityIteration": false,
            "capabilityType": null,
            "tokenCountUpUntilHere": null,
            "thinking": null
        });

        let bubble2 = serde_json::json!({
            "type": 2,
            "text": "Sure, I can help you.",
            "createdAt": "2024-01-01T10:00:01Z",
            "tokenCount": { "inputTokens": 50, "outputTokens": 100 },
            "modelInfo": { "modelName": "claude-3-sonnet" },
            "timingInfo": { "clientStartTime": 1700000001000.0_f64 },
            "toolFormerData": null,
            "isCapabilityIteration": false,
            "capabilityType": null,
            "tokenCountUpUntilHere": 150.0,
            "thinking": { "text": "Let me think about this..." }
        });

        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["bubbleId:test-composer-123:0", bubble1.to_string()],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["bubbleId:test-composer-123:1", bubble2.to_string()],
        )
        .unwrap();

        // Insert an invalid bubble (bad JSON)
        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["bubbleId:test-composer-123:2", "not-json"],
        )
        .unwrap();

        drop(conn);
        (tmp, path)
    }

    #[test]
    fn parse_cursor_db_extracts_conversations() {
        let (_tmp, path) = create_test_vscdb();
        let convs = parse_cursor_db(&path).unwrap();

        // Should have exactly 1 valid conversation (short and invalid are filtered)
        assert_eq!(convs.len(), 1);
        assert_eq!(convs[0].composer_id, "test-composer-123");
        assert_eq!(convs[0].name, Some("Test Conversation".to_string()));
        assert_eq!(convs[0].created_at, 1700000000000.0);
        assert_eq!(convs[0].last_updated_at, 1700001000000.0);
        assert_eq!(convs[0].status, Some("active".to_string()));
        assert!(convs[0].is_agentic);
        assert_eq!(
            convs[0].workspace_path,
            Some("/Users/test/project".to_string())
        );
    }

    #[test]
    fn parse_cursor_db_opens_readonly() {
        let (_tmp, path) = create_test_vscdb();
        // Should succeed -- the function opens readonly
        let result = parse_cursor_db(&path);
        assert!(result.is_ok());
    }

    #[test]
    fn parse_cursor_db_skips_invalid_json() {
        let (_tmp, path) = create_test_vscdb();
        let convs = parse_cursor_db(&path).unwrap();
        // Only 1 valid conversation, not 3
        assert_eq!(convs.len(), 1);
    }

    #[test]
    fn get_bubbles_extracts_all_fields() {
        let (_tmp, path) = create_test_vscdb();
        let bubbles = get_bubbles_for_conversation(&path, "test-composer-123").unwrap();

        // Should have 2 valid bubbles (invalid JSON skipped)
        assert_eq!(bubbles.len(), 2);

        // First bubble: user
        assert_eq!(bubbles[0].bubble_id, "0");
        assert_eq!(bubbles[0].bubble_type, 1);
        assert_eq!(bubbles[0].text, "Hello, help me with code");

        // Second bubble: assistant
        assert_eq!(bubbles[1].bubble_id, "1");
        assert_eq!(bubbles[1].bubble_type, 2);
        assert_eq!(bubbles[1].text, "Sure, I can help you.");
        assert!(bubbles[1].token_count.is_some());
        assert!(bubbles[1].model_info.is_some());
        assert!(bubbles[1].thinking.is_some());
    }

    #[test]
    fn get_bubbles_ordered_by_rowid() {
        let (_tmp, path) = create_test_vscdb();
        let bubbles = get_bubbles_for_conversation(&path, "test-composer-123").unwrap();
        // Should be in insertion order: bubble 0 then bubble 1
        assert_eq!(bubbles[0].bubble_id, "0");
        assert_eq!(bubbles[1].bubble_id, "1");
    }

    #[test]
    fn workspace_path_fallback_chain() {
        let tmp = tempfile::NamedTempFile::new().unwrap();
        let path = tmp.path().to_string_lossy().to_string();

        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            "CREATE TABLE cursorDiskKV (key TEXT PRIMARY KEY, value BLOB);",
        )
        .unwrap();

        // Test workspaceFolder fallback
        let data1 = serde_json::json!({
            "name": "Fallback Test",
            "createdAt": 1700000000000.0_f64,
            "lastUpdatedAt": 1700000000000.0_f64,
            "workspaceFolder": "/fallback/workspace"
        });
        let data1_str = data1.to_string();
        let padded = format!(
            "{}{}",
            &data1_str[..data1_str.len() - 1],
            r#","_pad":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}"#
        );
        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["composerData:fb1", padded],
        )
        .unwrap();

        // Test rootDir fallback
        let data2 = serde_json::json!({
            "name": "RootDir Test",
            "createdAt": 1700000000000.0_f64,
            "lastUpdatedAt": 1700000000000.0_f64,
            "rootDir": "/root/dir/path"
        });
        let data2_str = data2.to_string();
        let padded2 = format!(
            "{}{}",
            &data2_str[..data2_str.len() - 1],
            r#","_pad":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}"#
        );
        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["composerData:fb2", padded2],
        )
        .unwrap();

        // Test context.workspacePath fallback
        let data3 = serde_json::json!({
            "name": "Context WS Test",
            "createdAt": 1700000000000.0_f64,
            "lastUpdatedAt": 1700000000000.0_f64,
            "context": { "workspacePath": "/context/ws/path" }
        });
        let data3_str = data3.to_string();
        let padded3 = format!(
            "{}{}",
            &data3_str[..data3_str.len() - 1],
            r#","_pad":"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}"#
        );
        conn.execute(
            "INSERT INTO cursorDiskKV (key, value) VALUES (?1, ?2)",
            rusqlite::params!["composerData:fb3", padded3],
        )
        .unwrap();

        drop(conn);

        let convs = parse_cursor_db(&path).unwrap();
        assert_eq!(convs.len(), 3);

        // Sort by composer_id for predictable ordering
        let mut sorted: Vec<_> = convs.iter().collect();
        sorted.sort_by_key(|c| &c.composer_id);

        assert_eq!(
            sorted[0].workspace_path,
            Some("/fallback/workspace".to_string())
        );
        assert_eq!(
            sorted[1].workspace_path,
            Some("/root/dir/path".to_string())
        );
        assert_eq!(
            sorted[2].workspace_path,
            Some("/context/ws/path".to_string())
        );
    }

    #[test]
    fn nonexistent_db_returns_error() {
        let result = parse_cursor_db("/nonexistent/path/to/db.vscdb");
        assert!(result.is_err());
    }
}
