use serde_json::{json, Value};
use tokio_rusqlite::rusqlite::{self, Connection};

use super::types::NormalizedData;

/// Pre-transaction snapshot of conversation state for change detection.
#[derive(Debug, Clone)]
pub struct ConversationSnapshot {
    pub exists: bool,
    pub message_count: i64,
    pub tool_call_count: i64,
    pub token_usage_count: i64,
    pub plan_count: i64,
    pub status: Option<String>,
    pub title: Option<String>,
    pub model: Option<String>,
}

/// Snapshot the current DB state for a conversation before inserting new data.
/// Returns counts of messages, tool_calls, token_usage, and plans, plus metadata.
pub fn snapshot_conversation(
    conn: &Connection,
    conversation_id: &str,
) -> ConversationSnapshot {
    // Check if conversation exists and get metadata
    let existing = conn.query_row(
        "SELECT status, title, model FROM conversations WHERE id = ?1",
        rusqlite::params![conversation_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        },
    );

    let (status, title, model) = match existing {
        Ok(vals) => vals,
        Err(_) => {
            return ConversationSnapshot {
                exists: false,
                message_count: 0,
                tool_call_count: 0,
                token_usage_count: 0,
                plan_count: 0,
                status: None,
                title: None,
                model: None,
            };
        }
    };

    let message_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM messages WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let tool_call_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM tool_calls WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let token_usage_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM token_usage WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let plan_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM plans WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    ConversationSnapshot {
        exists: true,
        message_count,
        tool_call_count,
        token_usage_count,
        plan_count,
        status,
        title,
        model,
    }
}

/// Compare post-insert state against pre-transaction snapshot.
/// Returns WebSocket event payloads for conversation:created or conversation:changed.
pub fn track_changes(
    conn: &Connection,
    conversation_id: &str,
    normalized: &NormalizedData,
    snapshot: &ConversationSnapshot,
) -> Vec<Value> {
    let now = chrono::Utc::now().to_rfc3339();

    if !snapshot.exists {
        return vec![json!({
            "type": "conversation:created",
            "conversationId": conversation_id,
            "summary": {
                "title": normalized.conversation.title,
                "agent": normalized.conversation.agent,
                "project": normalized.conversation.project,
                "createdAt": normalized.conversation.created_at,
            },
            "timestamp": now,
        })];
    }

    // Existing conversation: compare counts
    let mut changes: Vec<&str> = Vec::new();

    let new_msg_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM messages WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if new_msg_count > snapshot.message_count {
        changes.push("messages-added");
    }

    let new_tc_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM tool_calls WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if new_tc_count > snapshot.tool_call_count {
        changes.push("tool-calls-added");
    }

    let new_tu_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM token_usage WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if new_tu_count > snapshot.token_usage_count {
        changes.push("tokens-updated");
    }

    let new_pl_count: i64 = conn
        .query_row(
            "SELECT count(*) FROM plans WHERE conversation_id = ?1",
            rusqlite::params![conversation_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    if new_pl_count > snapshot.plan_count {
        changes.push("plan-updated");
    }

    // Check status/title/model changes
    let updated = conn.query_row(
        "SELECT status, title, model FROM conversations WHERE id = ?1",
        rusqlite::params![conversation_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        },
    );

    if let Ok((new_status, new_title, new_model)) = updated {
        if new_status != snapshot.status {
            changes.push("status-changed");
        }
        if new_title != snapshot.title || new_model != snapshot.model {
            changes.push("metadata-changed");
        }
    }

    if changes.is_empty() {
        return vec![];
    }

    vec![json!({
        "type": "conversation:changed",
        "conversationId": conversation_id,
        "changes": changes,
        "timestamp": now,
    })]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ingestion::types::{ConversationRecord, NormalizedData};

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../schema.sql")).unwrap();
        conn
    }

    #[test]
    fn snapshot_nonexistent_conversation() {
        let conn = create_test_db();
        let snap = snapshot_conversation(&conn, "nonexistent");
        assert!(!snap.exists);
        assert_eq!(snap.message_count, 0);
    }

    #[test]
    fn snapshot_existing_conversation() {
        let conn = create_test_db();
        conn.execute(
            "INSERT INTO conversations (id, agent, created_at, updated_at, status) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params!["conv-1", "claude-code", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", "active"],
        ).unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, created_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params!["msg-1", "conv-1", "user", "2024-01-01T00:00:00Z"],
        ).unwrap();

        let snap = snapshot_conversation(&conn, "conv-1");
        assert!(snap.exists);
        assert_eq!(snap.message_count, 1);
        assert_eq!(snap.status, Some("active".to_string()));
    }

    #[test]
    fn track_changes_new_conversation() {
        let conn = create_test_db();
        let normalized = NormalizedData {
            conversation: ConversationRecord {
                id: "conv-1".to_string(),
                agent: "claude-code".to_string(),
                project: Some("test".to_string()),
                title: Some("Test".to_string()),
                created_at: "2024-01-01T00:00:00Z".to_string(),
                updated_at: "2024-01-01T00:00:00Z".to_string(),
                model: None,
            },
            messages: vec![],
            tool_calls: vec![],
            token_usage: vec![],
            compaction_events: vec![],
        };
        let snap = ConversationSnapshot {
            exists: false,
            message_count: 0,
            tool_call_count: 0,
            token_usage_count: 0,
            plan_count: 0,
            status: None,
            title: None,
            model: None,
        };

        let events = track_changes(&conn, "conv-1", &normalized, &snap);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0]["type"], "conversation:created");
    }
}
