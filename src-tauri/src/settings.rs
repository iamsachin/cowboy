use axum::{
    extract::{Query, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::error::AppError;
use crate::server::AppState;

// ── Route Registration ──────────────────────────────────────────────

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/settings", get(get_settings))
        .route("/api/settings/agent", put(update_agent))
        .route("/api/settings/sync", put(update_sync))
        .route("/api/settings/port", put(update_port))
        .route("/api/settings/validate-path", post(validate_path))
        .route("/api/settings/clear-db", delete(clear_db))
        .route("/api/settings/db-stats", get(db_stats))
        .route("/api/settings/refresh-db", post(refresh_db))
        .route("/api/settings/test-sync", post(test_sync))
        .route("/api/settings/sync-now", post(sync_now))
}

// ── Response Structs ────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    pub id: i64,
    pub claude_code_path: String,
    pub claude_code_enabled: bool,
    pub sync_enabled: bool,
    pub sync_url: String,
    pub sync_frequency: i64,
    pub sync_categories: Vec<String>,
    pub last_sync_at: Option<String>,
    pub last_sync_error: Option<String>,
    pub last_sync_success: Option<bool>,
    pub server_port: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentSettingsBody {
    claude_code_path: String,
    claude_code_enabled: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncSettingsBody {
    sync_enabled: bool,
    sync_url: String,
    sync_frequency: i64,
    sync_categories: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PortSettingsBody {
    server_port: i64,
}

#[derive(Deserialize)]
struct ValidatePathBody {
    path: String,
    agent: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ValidatePathResponse {
    valid: bool,
    file_count: usize,
    message: String,
}

#[derive(Deserialize)]
struct ClearDbParams {
    agent: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DbStatsResponse {
    total: DbStatsTotals,
    by_agent: HashMap<String, i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DbStatsTotals {
    conversations: i64,
    messages: i64,
    tool_calls: i64,
    token_usage: i64,
    plans: i64,
}

// ── Helpers ─────────────────────────────────────────────────────────

fn expand_tilde(path: &str) -> String {
    if path.starts_with("~/") || path == "~" {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}{}", home, &path[1..]);
        }
    }
    path.to_string()
}

const SETTINGS_COLUMNS: &str =
    "id, claude_code_path, claude_code_enabled, \
     sync_enabled, sync_url, sync_frequency, sync_categories, \
     last_sync_at, last_sync_error, last_sync_success, server_port";

fn map_settings_row(row: &tokio_rusqlite::rusqlite::Row) -> tokio_rusqlite::rusqlite::Result<SettingsResponse> {
    let sync_categories_str: String = row.get(6)?;
    let sync_categories: Vec<String> =
        serde_json::from_str(&sync_categories_str).unwrap_or_default();

    let last_sync_success_int: Option<i32> = row.get(9)?;
    let last_sync_success = last_sync_success_int.map(|v| v != 0);

    Ok(SettingsResponse {
        id: row.get(0)?,
        claude_code_path: row.get(1)?,
        claude_code_enabled: row.get::<_, i32>(2)? != 0,
        sync_enabled: row.get::<_, i32>(3)? != 0,
        sync_url: row.get(4)?,
        sync_frequency: row.get(5)?,
        sync_categories,
        last_sync_at: row.get(7)?,
        last_sync_error: row.get(8)?,
        last_sync_success,
        server_port: row.get(10)?,
    })
}

fn get_or_seed_settings(
    conn: &tokio_rusqlite::rusqlite::Connection,
) -> tokio_rusqlite::rusqlite::Result<SettingsResponse> {
    let select_sql = format!("SELECT {} FROM settings WHERE id = 1", SETTINGS_COLUMNS);

    let existing = conn.query_row(&select_sql, [], map_settings_row);

    match existing {
        Ok(row) => Ok(row),
        Err(tokio_rusqlite::rusqlite::Error::QueryReturnedNoRows) => {
            // Seed defaults
            let home = std::env::var("HOME").unwrap_or_default();
            let default_claude_path = format!("{}/.claude/projects", home);

            conn.execute(
                "INSERT INTO settings (id, claude_code_path, claude_code_enabled,
                    sync_enabled, sync_url, sync_frequency, sync_categories, server_port)
                 VALUES (1, ?1, 1, 0, '', 900, ?2, 8123)",
                tokio_rusqlite::rusqlite::params![
                    default_claude_path,
                    r#"["conversations","messages","toolCalls","tokenUsage","plans"]"#,
                ],
            )?;

            conn.query_row(&select_sql, [], map_settings_row)
        }
        Err(e) => Err(e),
    }
}

// ── Handlers ────────────────────────────────────────────────────────

/// GET /api/settings
async fn get_settings(
    State(state): State<AppState>,
) -> Result<Json<SettingsResponse>, AppError> {
    let settings = state
        .db
        .call(|conn| Ok(get_or_seed_settings(conn)?))
        .await?;

    Ok(Json(settings))
}

/// PUT /api/settings/agent
async fn update_agent(
    State(state): State<AppState>,
    Json(body): Json<AgentSettingsBody>,
) -> Result<Json<SettingsResponse>, AppError> {
    let claude_path = expand_tilde(&body.claude_code_path);
    let claude_enabled = body.claude_code_enabled;

    let settings = state
        .db
        .call(move |conn| {
            // Ensure settings row exists
            get_or_seed_settings(conn)?;

            conn.execute(
                "UPDATE settings SET claude_code_path = ?1, claude_code_enabled = ?2 WHERE id = 1",
                tokio_rusqlite::rusqlite::params![
                    claude_path,
                    claude_enabled as i32,
                ],
            )?;

            Ok(get_or_seed_settings(conn)?)
        })
        .await?;

    // Broadcast settings:changed event
    crate::websocket::broadcast_event(&state, "settings:changed", None);

    // Restart file watcher with new settings
    {
        let mut watcher_lock = state.watcher.lock().await;
        // Drop old watcher (triggers shutdown via oneshot channel)
        *watcher_lock = None;

        // Start new watcher with updated settings
        match crate::watcher::start_watcher(
            state.clone(),
            Some(settings.claude_code_path.clone()),
            settings.claude_code_enabled,
        ) {
            Ok(handle) => {
                *watcher_lock = Some(handle);
                println!("File watcher restarted with updated agent settings");
            }
            Err(e) => eprintln!("Failed to restart file watcher: {}", e),
        }
    }

    // Trigger re-ingestion with new paths
    let state_for_ingest = state.clone();
    let status = state.ingestion_status.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::ingestion::run_ingestion(&state_for_ingest, status.clone()).await {
            eprintln!("Re-ingestion after agent settings change error: {}", e);
            let mut s = status.lock().await;
            s.error = Some(e.to_string());
            s.running = false;
        }
    });

    Ok(Json(settings))
}

/// PUT /api/settings/sync
async fn update_sync(
    State(state): State<AppState>,
    Json(body): Json<SyncSettingsBody>,
) -> Result<Json<SettingsResponse>, AppError> {
    let sync_enabled = body.sync_enabled;
    let sync_url = body.sync_url;
    let sync_frequency = body.sync_frequency;
    let sync_categories_json =
        serde_json::to_string(&body.sync_categories).unwrap_or_else(|_| "[]".to_string());

    let settings = state
        .db
        .call(move |conn| {
            // Ensure settings row exists
            get_or_seed_settings(conn)?;

            conn.execute(
                "UPDATE settings SET sync_enabled = ?1, sync_url = ?2,
                    sync_frequency = ?3, sync_categories = ?4 WHERE id = 1",
                tokio_rusqlite::rusqlite::params![
                    sync_enabled as i32,
                    sync_url,
                    sync_frequency,
                    sync_categories_json,
                ],
            )?;

            Ok(get_or_seed_settings(conn)?)
        })
        .await?;

    // Broadcast settings:changed event
    crate::websocket::broadcast_event(&state, "settings:changed", None);

    Ok(Json(settings))
}

/// PUT /api/settings/port
async fn update_port(
    State(state): State<AppState>,
    Json(body): Json<PortSettingsBody>,
) -> Result<Json<SettingsResponse>, AppError> {
    let port = body.server_port;

    let settings = state
        .db
        .call(move |conn| {
            get_or_seed_settings(conn)?;

            conn.execute(
                "UPDATE settings SET server_port = ?1 WHERE id = 1",
                tokio_rusqlite::rusqlite::params![port],
            )?;

            Ok(get_or_seed_settings(conn)?)
        })
        .await?;

    crate::websocket::broadcast_event(&state, "settings:changed", None);

    Ok(Json(settings))
}

/// POST /api/settings/validate-path
async fn validate_path(
    Json(body): Json<ValidatePathBody>,
) -> Result<Json<ValidatePathResponse>, AppError> {
    let resolved = expand_tilde(&body.path);
    let agent = body.agent;

    let result = tokio::task::spawn_blocking(move || {
        let path = std::path::Path::new(&resolved);

        if !path.is_dir() {
            return ValidatePathResponse {
                valid: false,
                file_count: 0,
                message: "Path not found or not a directory".to_string(),
            };
        }

        if agent == "claude-code" {
            // Recursively count .jsonl files
            let count = count_jsonl_files(path);
            ValidatePathResponse {
                valid: true,
                file_count: count,
                message: format!("Path exists: {} JSONL files found", count),
            }
        } else {
            ValidatePathResponse {
                valid: false,
                file_count: 0,
                message: "Unknown agent".to_string(),
            }
        }
    })
    .await
    .map_err(|e| AppError::BadRequest(format!("Task join error: {}", e)))?;

    Ok(Json(result))
}

fn count_jsonl_files(dir: &std::path::Path) -> usize {
    let mut count = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                count += count_jsonl_files(&path);
            } else if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                count += 1;
            }
        }
    }
    count
}

/// DELETE /api/settings/clear-db
async fn clear_db(
    State(state): State<AppState>,
    Query(params): Query<ClearDbParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let agent = params.agent.clone();

    state
        .db
        .call(move |conn| {
            let tx = conn.transaction()?;

            if let Some(ref agent_filter) = agent {
                // Collect conversation IDs for the target agent
                let mut stmt =
                    tx.prepare("SELECT id FROM conversations WHERE agent = ?1")?;
                let conv_ids: Vec<String> = stmt
                    .query_map(tokio_rusqlite::rusqlite::params![agent_filter], |row| {
                        row.get(0)
                    })?
                    .collect::<Result<Vec<_>, _>>()?;

                if !conv_ids.is_empty() {
                    // Build IN clause
                    let placeholders: String =
                        conv_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");

                    // Get plan IDs for scoped plan_steps delete
                    let plan_sql = format!(
                        "SELECT id FROM plans WHERE conversation_id IN ({})",
                        placeholders
                    );
                    let plan_params: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                        conv_ids.iter().map(|s| s as &dyn tokio_rusqlite::rusqlite::types::ToSql).collect();
                    let mut plan_stmt = tx.prepare(&plan_sql)?;
                    let plan_ids: Vec<String> = plan_stmt
                        .query_map(plan_params.as_slice(), |row| row.get(0))?
                        .collect::<Result<Vec<_>, _>>()?;

                    // Delete plan_steps for scoped plans
                    if !plan_ids.is_empty() {
                        let ps_ph: String =
                            plan_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                        let ps_sql =
                            format!("DELETE FROM plan_steps WHERE plan_id IN ({})", ps_ph);
                        let ps_params: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                            plan_ids.iter().map(|s| s as &dyn tokio_rusqlite::rusqlite::types::ToSql).collect();
                        tx.execute(&ps_sql, ps_params.as_slice())?;
                    }

                    // FK-safe order: plans, tool_calls, token_usage, compaction_events, messages, conversations
                    let tables = [
                        "plans",
                        "tool_calls",
                        "token_usage",
                        "compaction_events",
                        "messages",
                        "conversations",
                    ];
                    let col = "conversation_id";

                    for table in &tables {
                        let key = if *table == "conversations" { "id" } else { col };
                        let del_sql = format!(
                            "DELETE FROM {} WHERE {} IN ({})",
                            table, key, placeholders
                        );
                        let del_params: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                            conv_ids.iter().map(|s| s as &dyn tokio_rusqlite::rusqlite::types::ToSql).collect();
                        tx.execute(&del_sql, del_params.as_slice())?;
                    }
                }
            } else {
                // Delete all data tables in FK-safe order
                tx.execute_batch(
                    "DELETE FROM plan_steps;
                     DELETE FROM plans;
                     DELETE FROM tool_calls;
                     DELETE FROM token_usage;
                     DELETE FROM compaction_events;
                     DELETE FROM messages;
                     DELETE FROM conversations;
                     DELETE FROM ingested_files;",
                )?;
            }

            tx.commit()?;
            Ok(())
        })
        .await?;

    // Broadcast full-refresh event (uses monotonic seq for gap detection)
    crate::websocket::broadcast_event(&state, "system:full-refresh", None);

    let response = if let Some(agent_name) = params.agent {
        serde_json::json!({ "message": "Database cleared", "agent": agent_name })
    } else {
        serde_json::json!({ "message": "Database cleared" })
    };

    Ok(Json(response))
}

/// GET /api/settings/db-stats
async fn db_stats(
    State(state): State<AppState>,
) -> Result<Json<DbStatsResponse>, AppError> {
    let result = state
        .db
        .call(|conn| {
            let conversations: i64 =
                conn.query_row("SELECT count(*) FROM conversations", [], |r| r.get(0))?;
            let messages: i64 =
                conn.query_row("SELECT count(*) FROM messages", [], |r| r.get(0))?;
            let tool_calls: i64 =
                conn.query_row("SELECT count(*) FROM tool_calls", [], |r| r.get(0))?;
            let token_usage: i64 =
                conn.query_row("SELECT count(*) FROM token_usage", [], |r| r.get(0))?;
            let plans: i64 =
                conn.query_row("SELECT count(*) FROM plans", [], |r| r.get(0))?;

            // Per-agent conversation counts
            let mut stmt =
                conn.prepare("SELECT agent, count(*) FROM conversations GROUP BY agent")?;
            let by_agent: HashMap<String, i64> = stmt
                .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))?
                .collect::<Result<HashMap<_, _>, _>>()?;

            Ok(DbStatsResponse {
                total: DbStatsTotals {
                    conversations,
                    messages,
                    tool_calls,
                    token_usage,
                    plans,
                },
                by_agent,
            })
        })
        .await?;

    Ok(Json(result))
}

/// POST /api/settings/refresh-db
async fn refresh_db(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    let status = state.ingestion_status.clone();
    {
        let s = status.lock().await;
        if s.running {
            return Err(AppError::BadRequest("Ingestion already in progress".into()));
        }
    }

    // Clear ingestion cache so all files are re-processed
    state
        .db
        .call(|conn| {
            conn.execute("DELETE FROM ingested_files", [])?;
            Ok::<_, tokio_rusqlite::rusqlite::Error>(())
        })
        .await
        .map_err(|e| AppError::BadRequest(format!("Failed to clear ingestion cache: {}", e)))?;

    let state_for_ingest = state.clone();
    let status_clone = status.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::ingestion::run_ingestion(&state_for_ingest, status_clone.clone()).await {
            eprintln!("Refresh-db ingestion error: {}", e);
            let mut s = status_clone.lock().await;
            s.error = Some(e.to_string());
            s.running = false;
        }
    });

    Ok(Json(serde_json::json!({"message": "Database refresh started"})))
}

/// POST /api/settings/test-sync -- 501 stub
async fn test_sync() -> Result<(), AppError> {
    Err(AppError::NotImplemented(
        "Remote sync out of scope for v3.0".into(),
    ))
}

/// POST /api/settings/sync-now -- 501 stub
async fn sync_now() -> Result<(), AppError> {
    Err(AppError::NotImplemented(
        "Remote sync out of scope for v3.0".into(),
    ))
}
