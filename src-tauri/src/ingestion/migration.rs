use std::sync::LazyLock;

use regex::Regex;
use tokio_rusqlite::rusqlite::{self, Connection};

use super::cursor_file_discovery::discover_cursor_db;
use super::cursor_parser::{get_bubbles_for_conversation, parse_cursor_db};
use super::id_generator::generate_id;
use super::title_utils::should_skip_for_title;

/// Result of running all data quality migrations.
#[derive(Debug, Clone, Default)]
pub struct MigrationResult {
    pub cursor_data_purged: usize,
    pub titles_fixed: usize,
    pub models_fixed: usize,
    pub cursor_projects_fixed: usize,
    pub cursor_messages_fixed: usize,
    pub content_fixed: usize,
    pub stale_links_cleared: usize,
}

/// System-injected XML tag pattern for content cleanup.
static SYSTEM_TAG_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"</?(system-reminder|local-command-caveat|local-command-stdout|command-name|command-message|command-args|antml:[a-z-]+)(?:\s[^>]*)?\s*/?>").unwrap()
});

static MULTI_NEWLINE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\n{3,}").unwrap());

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

fn strip_system_xml_tags(text: &str) -> String {
    let cleaned = SYSTEM_TAG_PATTERN.replace_all(text, "");
    let cleaned = MULTI_NEWLINE.replace_all(&cleaned, "\n\n");
    cleaned.trim().to_string()
}

/// Run all data quality migrations. Idempotent: safe to call on every startup.
pub fn run_data_quality_migration(conn: &Connection) -> MigrationResult {
    // Purge cursor data first so subsequent migrations don't waste time on it
    let cursor_data_purged = purge_cursor_data(conn);

    let titles_fixed = fix_conversation_titles(conn);
    let models_fixed = fix_conversation_models(conn);

    let cursor_db_path = discover_cursor_db();
    let cursor_projects_fixed = fix_cursor_projects(conn, cursor_db_path.as_deref());
    let cursor_messages_fixed = fix_cursor_message_content(conn, cursor_db_path.as_deref());
    let content_fixed = fix_duplicate_content_blocks(conn);
    let stale_links_cleared = clear_stale_subagent_links(conn);

    MigrationResult {
        cursor_data_purged,
        titles_fixed,
        models_fixed,
        cursor_projects_fixed,
        cursor_messages_fixed,
        content_fixed,
        stale_links_cleared,
    }
}

/// Fix conversations with bad or missing titles.
fn fix_conversation_titles(conn: &Connection) -> usize {
    let mut stmt = conn
        .prepare("SELECT id, title FROM conversations")
        .unwrap();

    let convs: Vec<(String, Option<String>)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let mut fixed = 0;

    for (conv_id, title) in &convs {
        if !needs_title_fix(title.as_deref()) {
            continue;
        }

        // Query user messages ordered by created_at
        let mut msg_stmt = conn
            .prepare(
                "SELECT content FROM messages WHERE conversation_id = ?1 AND role = 'user' ORDER BY created_at",
            )
            .unwrap();
        let user_messages: Vec<Option<String>> = msg_stmt
            .query_map(rusqlite::params![conv_id], |row| {
                row.get::<_, Option<String>>(0)
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let mut new_title: Option<String> = None;

        // First pass: first non-skippable user message
        for content in &user_messages {
            if let Some(ref text) = content {
                let trimmed = text.trim();
                if !trimmed.is_empty() {
                    if should_skip_for_title(text) {
                        continue;
                    }
                    new_title = Some(truncate(text, 100));
                    break;
                }
            }
        }

        // Second pass: XML fallback
        if new_title.is_none() {
            for content in &user_messages {
                if let Some(ref text) = content {
                    if text.trim().starts_with('<') {
                        let stripped = strip_xml_tags(text);
                        if stripped.len() > 10 {
                            new_title = Some(truncate(&stripped, 100));
                            break;
                        }
                    }
                }
            }
        }

        // Third pass: assistant text fallback
        if new_title.is_none() {
            let mut asst_stmt = conn
                .prepare(
                    "SELECT content FROM messages WHERE conversation_id = ?1 AND role = 'assistant' ORDER BY created_at",
                )
                .unwrap();
            let asst_messages: Vec<Option<String>> = asst_stmt
                .query_map(rusqlite::params![conv_id], |row| {
                    row.get::<_, Option<String>>(0)
                })
                .unwrap()
                .filter_map(|r| r.ok())
                .collect();

            for content in &asst_messages {
                if let Some(ref text) = content {
                    if !text.trim().is_empty() {
                        new_title = Some(truncate(text, 100));
                        break;
                    }
                }
            }
        }

        if let Some(ref title) = new_title {
            conn.execute(
                "UPDATE conversations SET title = ?1 WHERE id = ?2",
                rusqlite::params![title, conv_id],
            )
            .unwrap();
            fixed += 1;
        }
    }

    fixed
}

fn needs_title_fix(title: Option<&str>) -> bool {
    match title {
        None => true,
        Some(t) => {
            let trimmed = t.trim();
            if trimmed.is_empty() {
                return true;
            }
            should_skip_for_title(trimmed)
        }
    }
}

/// Fix conversations with NULL or "default" models.
fn fix_conversation_models(conn: &Connection) -> usize {
    let mut fixed = 0;

    // Fix NULL model conversations using token_usage frequency
    let mut null_stmt = conn
        .prepare("SELECT id FROM conversations WHERE model IS NULL")
        .unwrap();
    let null_convs: Vec<String> = null_stmt
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    for conv_id in &null_convs {
        // Try token_usage frequency first
        let model: Option<String> = conn
            .query_row(
                "SELECT model FROM token_usage WHERE conversation_id = ?1 GROUP BY model ORDER BY count(*) DESC LIMIT 1",
                rusqlite::params![conv_id],
                |row| row.get(0),
            )
            .ok();

        let model = model.or_else(|| {
            conn.query_row(
                "SELECT model FROM messages WHERE conversation_id = ?1 AND role = 'assistant' AND model IS NOT NULL GROUP BY model ORDER BY count(*) DESC LIMIT 1",
                rusqlite::params![conv_id],
                |row| row.get(0),
            )
            .ok()
        });

        if let Some(ref m) = model {
            conn.execute(
                "UPDATE conversations SET model = ?1 WHERE id = ?2",
                rusqlite::params![m, conv_id],
            )
            .unwrap();
            fixed += 1;
        }
    }

    // Fix Cursor conversations with "default" model
    let mut default_stmt = conn
        .prepare("SELECT id FROM conversations WHERE model = 'default' AND agent = 'cursor'")
        .unwrap();
    let default_convs: Vec<String> = default_stmt
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    for conv_id in &default_convs {
        let resolved: String = conn
            .query_row(
                "SELECT model FROM messages WHERE conversation_id = ?1 AND role = 'assistant' AND model IS NOT NULL AND model != 'default' GROUP BY model ORDER BY count(*) DESC LIMIT 1",
                rusqlite::params![conv_id],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| "unknown".to_string());

        conn.execute(
            "UPDATE conversations SET model = ?1 WHERE id = ?2",
            rusqlite::params![resolved, conv_id],
        )
        .unwrap();

        // Also fix per-message "default" model
        conn.execute(
            "UPDATE messages SET model = 'unknown' WHERE conversation_id = ?1 AND model = 'default'",
            rusqlite::params![conv_id],
        )
        .unwrap();

        fixed += 1;
    }

    fixed
}

/// Fix cursor conversations with hardcoded 'Cursor' project name.
fn fix_cursor_projects(conn: &Connection, cursor_db_path: Option<&str>) -> usize {
    let cursor_db_path = match cursor_db_path {
        Some(p) => p,
        None => return 0,
    };

    let mut stmt = conn
        .prepare("SELECT id FROM conversations WHERE agent = 'cursor' AND project = 'Cursor'")
        .unwrap();
    let cursor_convs: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    if cursor_convs.is_empty() {
        return 0;
    }

    let cursor_data = match parse_cursor_db(cursor_db_path) {
        Ok(data) => data,
        Err(_) => return 0,
    };

    // Build map: generateId('cursor', composerId) -> workspacePath
    let mut id_to_workspace = std::collections::HashMap::new();
    for conv in &cursor_data {
        if let Some(ref ws_path) = conv.workspace_path {
            let id = generate_id(&["cursor", &conv.composer_id]);
            id_to_workspace.insert(id, ws_path.clone());
        }
    }

    let mut fixed = 0;

    for conv_id in &cursor_convs {
        if let Some(ws_path) = id_to_workspace.get(conv_id) {
            let project_name = std::path::Path::new(ws_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            if !project_name.is_empty() {
                conn.execute(
                    "UPDATE conversations SET project = ?1 WHERE id = ?2",
                    rusqlite::params![project_name, conv_id],
                )
                .unwrap();
                fixed += 1;
            }
        }
    }

    fixed
}

/// Fix assistant messages with null/empty content in cursor conversations.
fn fix_cursor_message_content(conn: &Connection, cursor_db_path: Option<&str>) -> usize {
    let cursor_conv_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT id FROM conversations WHERE agent = 'cursor'")
            .unwrap();
        stmt.query_map([], |row| row.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };

    if cursor_conv_ids.is_empty() {
        return 0;
    }

    // Build IN clause
    let placeholders: Vec<String> = cursor_conv_ids.iter().map(|id| format!("'{}'", id.replace('\'', "''"))).collect();
    let in_clause = placeholders.join(",");

    let query = format!(
        "SELECT id, conversation_id FROM messages WHERE role = 'assistant' AND (content IS NULL OR content = '') AND conversation_id IN ({})",
        in_clause
    );

    let empty_messages: Vec<(String, String)> = {
        let mut stmt = conn.prepare(&query).unwrap();
        stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    };

    if empty_messages.is_empty() {
        return 0;
    }

    // Try to get cursor data for re-deriving content
    let cursor_data = cursor_db_path.and_then(|p| parse_cursor_db(p).ok());

    let mut conv_id_to_composer_id = std::collections::HashMap::new();
    if let Some(ref data) = cursor_data {
        for conv in data {
            let id = generate_id(&["cursor", &conv.composer_id]);
            conv_id_to_composer_id.insert(id, conv.composer_id.clone());
        }
    }

    let mut fixed = 0;

    for (msg_id, conv_id) in &empty_messages {
        let mut content: Option<String> = None;

        // Try to re-derive from Cursor DB
        if let (Some(db_path), Some(ref data)) = (cursor_db_path, &cursor_data) {
            if let Some(composer_id) = conv_id_to_composer_id.get(conv_id) {
                if let Ok(bubbles) = get_bubbles_for_conversation(db_path, composer_id) {
                    for bubble in &bubbles {
                        let candidate_id = generate_id(&[conv_id, &bubble.bubble_id]);
                        if candidate_id == *msg_id && !bubble.text.trim().is_empty() {
                            content = Some(bubble.text.clone());
                            break;
                        }
                    }
                }
            }
        }

        let content = content.unwrap_or_else(|| "Executed tool call".to_string());
        conn.execute(
            "UPDATE messages SET content = ?1 WHERE id = ?2",
            rusqlite::params![content, msg_id],
        )
        .unwrap();
        fixed += 1;
    }

    fixed
}

/// Fix existing assistant message content that contains system XML tags.
fn fix_duplicate_content_blocks(conn: &Connection) -> usize {
    let mut stmt = conn
        .prepare("SELECT id, content FROM messages WHERE role = 'assistant' AND content IS NOT NULL")
        .unwrap();

    let messages: Vec<(String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let mut fixed = 0;

    for (msg_id, content) in &messages {
        if !SYSTEM_TAG_PATTERN.is_match(content) {
            continue;
        }

        let cleaned = strip_system_xml_tags(content);
        if cleaned != *content {
            let new_content: Option<&str> = if cleaned.is_empty() { None } else { Some(&cleaned) };
            conn.execute(
                "UPDATE messages SET content = ?1 WHERE id = ?2",
                rusqlite::params![new_content, msg_id],
            )
            .unwrap();
            fixed += 1;
        }
    }

    fixed
}

/// One-time migration: purge all Cursor conversations and related records.
fn purge_cursor_data(conn: &Connection) -> usize {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS migrations_applied (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )",
    )
    .unwrap();

    let already: bool = conn
        .query_row(
            "SELECT 1 FROM migrations_applied WHERE name = 'purge_cursor_data_v1'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if already {
        return 0;
    }

    // Delete in child-first order within a transaction for atomicity
    let total: usize = conn
        .execute_batch("BEGIN TRANSACTION")
        .map(|_| {
            let mut total = 0usize;

            total += conn
                .execute(
                    "DELETE FROM plan_steps WHERE plan_id IN (SELECT id FROM plans WHERE conversation_id IN (SELECT id FROM conversations WHERE agent = 'cursor'))",
                    [],
                )
                .unwrap_or(0);

            total += conn
                .execute(
                    "DELETE FROM plans WHERE conversation_id IN (SELECT id FROM conversations WHERE agent = 'cursor')",
                    [],
                )
                .unwrap_or(0);

            total += conn
                .execute(
                    "DELETE FROM compaction_events WHERE conversation_id IN (SELECT id FROM conversations WHERE agent = 'cursor')",
                    [],
                )
                .unwrap_or(0);

            total += conn
                .execute(
                    "DELETE FROM token_usage WHERE conversation_id IN (SELECT id FROM conversations WHERE agent = 'cursor')",
                    [],
                )
                .unwrap_or(0);

            total += conn
                .execute(
                    "DELETE FROM tool_calls WHERE conversation_id IN (SELECT id FROM conversations WHERE agent = 'cursor')",
                    [],
                )
                .unwrap_or(0);

            total += conn
                .execute(
                    "DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE agent = 'cursor')",
                    [],
                )
                .unwrap_or(0);

            total += conn
                .execute(
                    "DELETE FROM conversations WHERE agent = 'cursor'",
                    [],
                )
                .unwrap_or(0);

            total += conn
                .execute(
                    "DELETE FROM ingested_files WHERE file_path LIKE '%.vscdb'",
                    [],
                )
                .unwrap_or(0);

            conn.execute_batch("COMMIT").unwrap();
            total
        })
        .unwrap_or(0);

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO migrations_applied (name, applied_at) VALUES ('purge_cursor_data_v1', ?1)",
        rusqlite::params![now],
    )
    .unwrap();

    total
}

/// One-time migration: clear stale subagent links from old heuristic matcher.
fn clear_stale_subagent_links(conn: &Connection) -> usize {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS migrations_applied (
            name TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )",
    )
    .unwrap();

    let already: bool = conn
        .query_row(
            "SELECT 1 FROM migrations_applied WHERE name = 'clear_stale_subagent_links_v1'",
            [],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if already {
        return 0;
    }

    let parent_cleared = conn
        .execute(
            "UPDATE conversations SET parent_conversation_id = NULL WHERE parent_conversation_id IS NOT NULL",
            [],
        )
        .unwrap_or(0);

    conn.execute_batch(
        "UPDATE tool_calls SET subagent_conversation_id = NULL, subagent_summary = NULL WHERE subagent_conversation_id IS NOT NULL",
    )
    .unwrap();

    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO migrations_applied (name, applied_at) VALUES ('clear_stale_subagent_links_v1', ?1)",
        rusqlite::params![now],
    )
    .unwrap();

    parent_cleared
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../schema.sql")).unwrap();
        conn
    }

    #[test]
    fn needs_title_fix_cases() {
        assert!(needs_title_fix(None));
        assert!(needs_title_fix(Some("")));
        assert!(needs_title_fix(Some("   ")));
        assert!(needs_title_fix(Some("/command")));
        assert!(!needs_title_fix(Some("Good title")));
    }

    #[test]
    fn fix_null_model_from_token_usage() {
        let conn = create_test_db();
        conn.execute(
            "INSERT INTO conversations (id, agent, created_at, updated_at, status) VALUES ('c1', 'claude-code', '2024-01-01', '2024-01-01', 'completed')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, created_at) VALUES ('m1', 'c1', 'assistant', '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO token_usage (id, conversation_id, message_id, model, input_tokens, output_tokens, created_at) VALUES ('t1', 'c1', 'm1', 'claude-3-opus', 100, 50, '2024-01-01')",
            [],
        ).unwrap();

        let fixed = fix_conversation_models(&conn);
        assert_eq!(fixed, 1);

        let model: String = conn
            .query_row("SELECT model FROM conversations WHERE id = 'c1'", [], |row| row.get(0))
            .unwrap();
        assert_eq!(model, "claude-3-opus");
    }

    #[test]
    fn purge_cursor_data_deletes_all_cursor_records() {
        let conn = create_test_db();

        // Insert a Claude Code conversation with full child records
        conn.execute(
            "INSERT INTO conversations (id, agent, created_at, updated_at, status, model) VALUES ('cc1', 'claude-code', '2024-01-01', '2024-01-01', 'completed', 'claude-3-opus')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, created_at, content) VALUES ('cc_m1', 'cc1', 'user', '2024-01-01', 'hello')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, created_at, content) VALUES ('cc_m2', 'cc1', 'assistant', '2024-01-01', 'hi there')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO tool_calls (id, message_id, conversation_id, name, created_at) VALUES ('cc_tc1', 'cc_m2', 'cc1', 'read_file', '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO token_usage (id, conversation_id, message_id, model, input_tokens, output_tokens, created_at) VALUES ('cc_tu1', 'cc1', 'cc_m2', 'claude-3-opus', 100, 50, '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO plans (id, conversation_id, source_message_id, title, total_steps, created_at) VALUES ('cc_p1', 'cc1', 'cc_m2', 'Plan A', 2, '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO plan_steps (id, plan_id, step_number, content, created_at) VALUES ('cc_ps1', 'cc_p1', 1, 'Step 1', '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO compaction_events (id, conversation_id, timestamp, created_at) VALUES ('cc_ce1', 'cc1', '2024-01-01', '2024-01-01')",
            [],
        ).unwrap();

        // Insert a Cursor conversation with full child records
        conn.execute(
            "INSERT INTO conversations (id, agent, created_at, updated_at, status, model) VALUES ('cur1', 'cursor', '2024-01-01', '2024-01-01', 'completed', 'gpt-4')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, created_at, content) VALUES ('cur_m1', 'cur1', 'user', '2024-01-01', 'hey')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, created_at, content) VALUES ('cur_m2', 'cur1', 'assistant', '2024-01-01', 'yo')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO tool_calls (id, message_id, conversation_id, name, created_at) VALUES ('cur_tc1', 'cur_m2', 'cur1', 'edit_file', '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO token_usage (id, conversation_id, message_id, model, input_tokens, output_tokens, created_at) VALUES ('cur_tu1', 'cur1', 'cur_m2', 'gpt-4', 200, 100, '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO plans (id, conversation_id, source_message_id, title, total_steps, created_at) VALUES ('cur_p1', 'cur1', 'cur_m2', 'Plan B', 3, '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO plan_steps (id, plan_id, step_number, content, created_at) VALUES ('cur_ps1', 'cur_p1', 1, 'Step X', '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO compaction_events (id, conversation_id, timestamp, created_at) VALUES ('cur_ce1', 'cur1', '2024-01-01', '2024-01-01')",
            [],
        ).unwrap();

        // Insert ingested files: one .vscdb (cursor) and one .jsonl (claude)
        conn.execute(
            "INSERT INTO ingested_files (file_path, mtime_ms, size, ingested_at) VALUES ('/path/to/state.vscdb', 1000, 5000, '2024-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO ingested_files (file_path, mtime_ms, size, ingested_at) VALUES ('/path/to/conv.jsonl', 2000, 3000, '2024-01-01')",
            [],
        ).unwrap();

        // Run the purge
        let purged = purge_cursor_data(&conn);
        assert!(purged > 0, "Should have purged some rows");

        // Assert: zero cursor conversations
        let cursor_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM conversations WHERE agent = 'cursor'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cursor_count, 0, "All cursor conversations should be deleted");

        // Assert: cursor child records gone
        let cursor_msgs: i64 = conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE conversation_id = 'cur1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cursor_msgs, 0);

        let cursor_tcs: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tool_calls WHERE conversation_id = 'cur1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cursor_tcs, 0);

        let cursor_tu: i64 = conn.query_row(
            "SELECT COUNT(*) FROM token_usage WHERE conversation_id = 'cur1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cursor_tu, 0);

        let cursor_plans: i64 = conn.query_row(
            "SELECT COUNT(*) FROM plans WHERE conversation_id = 'cur1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cursor_plans, 0);

        let cursor_steps: i64 = conn.query_row(
            "SELECT COUNT(*) FROM plan_steps WHERE plan_id = 'cur_p1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cursor_steps, 0);

        let cursor_ce: i64 = conn.query_row(
            "SELECT COUNT(*) FROM compaction_events WHERE conversation_id = 'cur1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cursor_ce, 0);

        // Assert: .vscdb ingested file gone
        let vscdb_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM ingested_files WHERE file_path LIKE '%.vscdb'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(vscdb_count, 0);

        // Assert: Claude Code conversation and ALL its child records still intact
        let cc_conv: i64 = conn.query_row(
            "SELECT COUNT(*) FROM conversations WHERE id = 'cc1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cc_conv, 1, "Claude Code conversation should be untouched");

        let cc_msgs: i64 = conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE conversation_id = 'cc1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cc_msgs, 2);

        let cc_tcs: i64 = conn.query_row(
            "SELECT COUNT(*) FROM tool_calls WHERE conversation_id = 'cc1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cc_tcs, 1);

        let cc_tu: i64 = conn.query_row(
            "SELECT COUNT(*) FROM token_usage WHERE conversation_id = 'cc1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cc_tu, 1);

        let cc_plans: i64 = conn.query_row(
            "SELECT COUNT(*) FROM plans WHERE conversation_id = 'cc1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cc_plans, 1);

        let cc_steps: i64 = conn.query_row(
            "SELECT COUNT(*) FROM plan_steps WHERE plan_id = 'cc_p1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cc_steps, 1);

        let cc_ce: i64 = conn.query_row(
            "SELECT COUNT(*) FROM compaction_events WHERE conversation_id = 'cc1'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(cc_ce, 1);

        // Assert: .jsonl ingested file still intact
        let jsonl_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM ingested_files WHERE file_path LIKE '%.jsonl'", [], |row| row.get(0)
        ).unwrap();
        assert_eq!(jsonl_count, 1);

        // Idempotent: second call returns 0
        let purged2 = purge_cursor_data(&conn);
        assert_eq!(purged2, 0, "Second call should be idempotent");
    }

    #[test]
    fn stale_links_cleared_once() {
        let conn = create_test_db();
        let cleared1 = clear_stale_subagent_links(&conn);
        let cleared2 = clear_stale_subagent_links(&conn);
        // Second run should return 0 (already applied)
        assert_eq!(cleared2, 0);
        // First run returns 0 too since no conversations have parent_conversation_id set
        assert_eq!(cleared1, 0);
    }
}
