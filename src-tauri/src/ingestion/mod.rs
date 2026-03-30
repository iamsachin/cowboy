pub mod types;
pub mod id_generator;
pub mod title_utils;
pub mod compaction_utils;
pub mod file_discovery;
pub mod claude_code_parser;
pub mod normalizer;
pub mod plan_extractor;
pub mod subagent_linker;
pub mod subagent_summarizer;
pub mod snapshot;
pub mod migration;

use std::collections::HashMap;
use std::sync::Arc;

use axum::{extract::State, routing::{get, post}, Json, Router};
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tokio_rusqlite::rusqlite;

use crate::server::AppState;
use crate::websocket::broadcast_event;

use self::claude_code_parser::parse_jsonl_file;
use self::file_discovery::discover_jsonl_files;
use self::id_generator::generate_id;
use self::migration::run_data_quality_migration;
use self::normalizer::normalize_conversation;
use self::plan_extractor::{extract_plans_from_tool_calls, infer_step_completion, CompletionContext, LaterMessage, ToolCallRef};
use self::snapshot::{snapshot_conversation, track_changes};
use self::subagent_linker::{link_subagents, ToolCallInfo};
use self::subagent_summarizer::summarize_subagent;
use self::types::{DiscoveredFile, IngestionLastRun, IngestionProgress, IngestionStats, IngestionStatus, NormalizedData};

// ── Shared ingestion status ─────────────────────────────────────────────

pub type SharedStatus = Arc<Mutex<IngestionStatus>>;

pub fn new_shared_status() -> SharedStatus {
    Arc::new(Mutex::new(IngestionStatus {
        running: false,
        progress: None,
        last_run: None,
    }))
}

// ── HTTP routes ─────────────────────────────────────────────────────────

pub fn routes() -> Router<AppState> {
    let status = new_shared_status();

    Router::new()
        .route("/api/ingest", post({
            let status = status.clone();
            move |state: State<AppState>| post_ingest(state, status)
        }))
        .route("/api/ingest/status", get({
            let status = status.clone();
            move || get_ingest_status(status)
        }))
}

async fn post_ingest(
    State(state): State<AppState>,
    status: SharedStatus,
) -> Json<Value> {
    {
        let s = status.lock().await;
        if s.running {
            return Json(json!({"error": "Ingestion already in progress"}));
        }
    }

    {
        let mut s = status.lock().await;
        s.running = true;
    }

    let status_clone = status.clone();
    tokio::spawn(async move {
        if let Err(e) = run_ingestion(&state, status_clone.clone()).await {
            eprintln!("Ingestion error: {}", e);
        }
        let mut s = status_clone.lock().await;
        s.running = false;
    });

    Json(json!({"message": "Ingestion started"}))
}

async fn get_ingest_status(status: SharedStatus) -> Json<IngestionStatus> {
    let s = status.lock().await;
    Json(s.clone())
}

// ── Auto-ingest on startup ──────────────────────────────────────────────

/// Spawn auto-ingest after a brief delay to let the server bind.
pub fn spawn_auto_ingest(state: AppState) {
    let status = new_shared_status();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Err(e) = run_ingestion(&state, status).await {
            eprintln!("Auto-ingest error: {}", e);
        }
    });
}

// ── Orchestrator ────────────────────────────────────────────────────────

pub async fn run_ingestion(
    state: &AppState,
    status: SharedStatus,
) -> Result<IngestionStats, Box<dyn std::error::Error + Send + Sync>> {
    let start_time = std::time::Instant::now();

    {
        let mut s = status.lock().await;
        s.running = true;
        s.progress = Some(IngestionProgress {
            files_processed: 0,
            total_files: 0,
        });
    }

    let mut stats = IngestionStats {
        files_scanned: 0,
        files_skipped: 0,
        conversations_found: 0,
        messages_parsed: 0,
        tool_calls_extracted: 0,
        tokens_recorded: 0,
        skipped_lines: 0,
        duration: 0.0,
    };

    // Ensure ingested_files table exists
    state
        .db
        .call(|conn| {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS ingested_files (
                    file_path TEXT PRIMARY KEY,
                    mtime_ms INTEGER NOT NULL,
                    size INTEGER NOT NULL,
                    ingested_at TEXT NOT NULL
                )",
            )?;
            Ok::<_, tokio_rusqlite::Error>(())
        })
        .await?;

    // Run data quality migration (non-fatal)
    let migration_result = state
        .db
        .call(|conn| {
            Ok::<_, tokio_rusqlite::Error>(run_data_quality_migration(conn))
        })
        .await;

    match migration_result {
        Ok(result) => {
            if result.cursor_data_purged > 0
                || result.titles_fixed > 0
                || result.models_fixed > 0
                || result.content_fixed > 0
                || result.stale_links_cleared > 0
            {
                println!("Data quality migration: {:?}", result);
            }
        }
        Err(e) => eprintln!("Data quality migration failed (non-fatal): {}", e),
    }

    let mut all_events: Vec<Value> = Vec::new();

    // ── Claude Code ingestion ───────────────────────────────────────────
    let files = discover_jsonl_files(None).await;
    stats.files_scanned = files.len();

    {
        let mut s = status.lock().await;
        if let Some(ref mut p) = s.progress {
            p.total_files = files.len();
        }
    }

    for file in &files {
        match process_claude_code_file(state, file, &mut stats).await {
            Ok(events) => all_events.extend(events),
            Err(e) => eprintln!("Error processing {}: {}", file.file_path, e),
        }

        let mut s = status.lock().await;
        if let Some(ref mut p) = s.progress {
            p.files_processed += 1;
        }
    }

    // ── Subagent linking ────────────────────────────────────────────────
    if let Err(e) = link_subagents_post_processing(state, &files).await {
        eprintln!("Subagent linking error (non-fatal): {}", e);
    }

    // ── Mark stale active conversations as completed ────────────────────
    state
        .db
        .call(|conn| {
            let five_min_ago = chrono::Utc::now()
                .checked_sub_signed(chrono::Duration::minutes(5))
                .unwrap()
                .to_rfc3339();
            conn.execute(
                "UPDATE conversations SET status = 'completed' WHERE status = 'active' AND updated_at <= ?1",
                rusqlite::params![five_min_ago],
            )?;
            Ok::<_, tokio_rusqlite::Error>(())
        })
        .await?;

    // ── Emit collected WebSocket events ─────────────────────────────────
    for event in &all_events {
        if let Some(event_type) = event.get("type").and_then(|t| t.as_str()) {
            broadcast_event(state, event_type, Some(event.clone()));
        }
    }

    stats.duration = start_time.elapsed().as_secs_f64() * 1000.0;

    // Update status
    {
        let mut s = status.lock().await;
        s.running = false;
        s.progress = None;
        s.last_run = Some(IngestionLastRun {
            completed_at: chrono::Utc::now().to_rfc3339(),
            stats: stats.clone(),
        });
    }

    println!(
        "Ingestion complete: {} files, {} conversations, {} events, {:.0}ms",
        stats.files_scanned, stats.conversations_found, all_events.len(), stats.duration
    );

    Ok(stats)
}

// ── Process a single Claude Code JSONL file ─────────────────────────────

async fn process_claude_code_file(
    state: &AppState,
    file: &DiscoveredFile,
    stats: &mut IngestionStats,
) -> Result<Vec<Value>, Box<dyn std::error::Error + Send + Sync>> {
    // Check mtime/size against cache
    let file_meta = tokio::fs::metadata(&file.file_path).await?;
    let mtime_ms = file_meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let file_size = file_meta.len() as i64;

    let file_path_clone = file.file_path.clone();
    let is_cached = state
        .db
        .call(move |conn| {
            let result = conn.query_row(
                "SELECT mtime_ms, size FROM ingested_files WHERE file_path = ?1",
                rusqlite::params![file_path_clone],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            );
            match result {
                Ok((cached_mtime, cached_size)) => {
                    Ok::<_, tokio_rusqlite::Error>(cached_mtime == mtime_ms && cached_size == file_size)
                }
                Err(_) => Ok::<_, tokio_rusqlite::Error>(false),
            }
        })
        .await?;

    if is_cached {
        stats.files_skipped += 1;
        return Ok(vec![]);
    }

    let parse_result = parse_jsonl_file(&file.file_path).await?;
    stats.skipped_lines += parse_result.skipped_lines;

    let normalized = normalize_conversation(
        &parse_result,
        &file.project_dir,
        if file.is_subagent {
            Some(file.session_id.as_str())
        } else {
            None
        },
    );

    let normalized = match normalized {
        Some(n) => n,
        None => return Ok(vec![]),
    };

    // Insert into DB and track changes
    let norm_clone = normalized.clone();
    let events = state
        .db
        .call(move |conn| {
            let snap = snapshot_conversation(conn, &norm_clone.conversation.id);
            let conv_id = norm_clone.conversation.id.clone();

            let tx = conn.transaction()?;
            insert_conversation_data(&tx, &norm_clone)?;
            insert_extracted_plans_sql(&tx, &norm_clone)?;
            tx.commit()?;

            let events = track_changes(conn, &conv_id, &norm_clone, &snap);
            Ok::<_, tokio_rusqlite::Error>(events)
        })
        .await?;

    // Record file as ingested
    let file_path_clone = file.file_path.clone();
    let now = chrono::Utc::now().to_rfc3339();
    state
        .db
        .call(move |conn| {
            conn.execute(
                "INSERT INTO ingested_files (file_path, mtime_ms, size, ingested_at) \
                 VALUES (?1, ?2, ?3, ?4) \
                 ON CONFLICT(file_path) DO UPDATE SET mtime_ms = ?2, size = ?3, ingested_at = ?4",
                rusqlite::params![file_path_clone, mtime_ms, file_size, now],
            )?;
            Ok::<_, tokio_rusqlite::Error>(())
        })
        .await?;

    stats.conversations_found += 1;
    stats.messages_parsed += normalized.messages.len();
    stats.tool_calls_extracted += normalized.tool_calls.len();
    stats.tokens_recorded += normalized.token_usage.len();

    Ok(events)
}

// ── Subagent linking post-processing ────────────────────────────────────

async fn link_subagents_post_processing(
    state: &AppState,
    files: &[DiscoveredFile],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let subagent_files: Vec<&DiscoveredFile> = files.iter().filter(|f| f.is_subagent).collect();
    if subagent_files.is_empty() {
        return Ok(());
    }

    // Phase A: Filesystem-based parent linking
    let subagent_data: Vec<(String, Option<String>)> = subagent_files
        .iter()
        .filter_map(|sf| {
            sf.parent_session_id.as_ref().map(|parent_sid| {
                (sf.session_id.clone(), Some(parent_sid.clone()))
            })
        })
        .collect();

    if !subagent_data.is_empty() {
        let data = subagent_data.clone();
        state
            .db
            .call(move |conn| {
                let tx = conn.transaction()?;
                for (sub_sid, parent_sid_opt) in &data {
                    if let Some(parent_sid) = parent_sid_opt {
                        let sub_conv_id = generate_id(&["claude-code", sub_sid]);
                        let parent_conv_id = generate_id(&["claude-code", parent_sid]);

                        // Verify both exist
                        let parent_exists: bool = tx
                            .query_row(
                                "SELECT 1 FROM conversations WHERE id = ?1",
                                rusqlite::params![parent_conv_id],
                                |_| Ok(true),
                            )
                            .unwrap_or(false);
                        let sub_exists: bool = tx
                            .query_row(
                                "SELECT 1 FROM conversations WHERE id = ?1",
                                rusqlite::params![sub_conv_id],
                                |_| Ok(true),
                            )
                            .unwrap_or(false);

                        if parent_exists && sub_exists {
                            tx.execute(
                                "UPDATE conversations SET parent_conversation_id = ?1 WHERE id = ?2",
                                rusqlite::params![parent_conv_id, sub_conv_id],
                            )?;
                        }
                    }
                }
                tx.commit()?;
                Ok::<_, tokio_rusqlite::Error>(())
            })
            .await?;
    }

    // Phase B: Tool-call matching for summaries
    let mut files_by_project: HashMap<String, Vec<DiscoveredFile>> = HashMap::new();
    for f in files {
        files_by_project
            .entry(f.project_dir.clone())
            .or_default()
            .push(f.clone());
    }

    for (_, project_files) in &files_by_project {
        let parent_files: Vec<DiscoveredFile> = project_files
            .iter()
            .filter(|f| !f.is_subagent)
            .cloned()
            .collect();
        let proj_subagent_files: Vec<DiscoveredFile> = project_files
            .iter()
            .filter(|f| f.is_subagent)
            .cloned()
            .collect();

        if proj_subagent_files.is_empty() || parent_files.is_empty() {
            continue;
        }

        // Get tool calls and conversation IDs from DB
        let parent_files_clone = parent_files.clone();
        let sub_files_clone = proj_subagent_files.clone();

        let links = state
            .db
            .call(move |conn| {
                let get_conv_id = |session_id: &str| -> Option<String> {
                    let conv_id = generate_id(&["claude-code", session_id]);
                    conn.query_row(
                        "SELECT id FROM conversations WHERE id = ?1",
                        rusqlite::params![conv_id],
                        |row| row.get::<_, String>(0),
                    )
                    .ok()
                };

                let get_tool_calls_fn = |conv_id: &str| -> Vec<ToolCallInfo> {
                    let mut stmt = conn
                        .prepare(
                            "SELECT id, name, input, output, created_at FROM tool_calls WHERE conversation_id = ?1",
                        )
                        .unwrap();
                    stmt.query_map(rusqlite::params![conv_id], |row| {
                        let input_str: Option<String> = row.get(2)?;
                        let input: Value = input_str
                            .and_then(|s| serde_json::from_str(&s).ok())
                            .unwrap_or(Value::Null);
                        let output_str: Option<String> = row.get(3)?;
                        Ok(ToolCallInfo {
                            id: row.get(0)?,
                            name: row.get(1)?,
                            input,
                            output: output_str,
                            created_at: row.get(4)?,
                        })
                    })
                    .unwrap()
                    .filter_map(|r| r.ok())
                    .collect()
                };

                let get_first_msg = |conv_id: &str| -> Option<String> {
                    conn.query_row(
                        "SELECT content FROM messages WHERE conversation_id = ?1 AND role = 'user' ORDER BY created_at LIMIT 1",
                        rusqlite::params![conv_id],
                        |row| row.get(0),
                    )
                    .ok()
                    .flatten()
                };

                let links = link_subagents(
                    &parent_files_clone,
                    &sub_files_clone,
                    &get_tool_calls_fn,
                    &get_conv_id,
                    Some(&get_first_msg),
                );

                Ok::<_, tokio_rusqlite::Error>(links)
            })
            .await?;

        if !links.is_empty() {
            // Update tool_calls with subagent references
            let links_for_update = links.clone();
            state
                .db
                .call(move |conn| {
                    let tx = conn.transaction()?;
                    for link in &links_for_update {
                        tx.execute(
                            "UPDATE tool_calls SET subagent_conversation_id = ?1 WHERE id = ?2",
                            rusqlite::params![link.subagent_conversation_id, link.tool_call_id],
                        )?;
                    }
                    tx.commit()?;
                    Ok::<_, tokio_rusqlite::Error>(())
                })
                .await?;

            // Compute summaries
            for link in &links {
                let sub_file = proj_subagent_files.iter().find(|f| {
                    let conv_id = generate_id(&["claude-code", &f.session_id]);
                    conv_id == link.subagent_conversation_id
                });

                if let Some(sf) = sub_file {
                    match parse_jsonl_file(&sf.file_path).await {
                        Ok(pr) => {
                            let summary = summarize_subagent(&pr);
                            let summary_json = json!({
                                "toolBreakdown": summary.tool_breakdown,
                                "filesTouched": summary.files_touched,
                                "totalToolCalls": summary.total_tool_calls,
                                "status": summary.status.as_str(),
                                "durationMs": summary.duration_ms,
                                "inputTokens": summary.input_tokens,
                                "outputTokens": summary.output_tokens,
                                "lastError": summary.last_error,
                                "matchConfidence": link.match_confidence.as_str(),
                            });

                            let tc_id = link.tool_call_id.clone();
                            let summary_str = summary_json.to_string();
                            state
                                .db
                                .call(move |conn| {
                                    conn.execute(
                                        "UPDATE tool_calls SET subagent_summary = ?1 WHERE id = ?2",
                                        rusqlite::params![summary_str, tc_id],
                                    )?;
                                    Ok::<_, tokio_rusqlite::Error>(())
                                })
                                .await
                                .ok();
                        }
                        Err(e) => {
                            eprintln!(
                                "Error computing subagent summary for {}: {}",
                                sf.file_path, e
                            );
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

// ── is_conversation_ongoing ─────────────────────────────────────────────

fn is_conversation_ongoing(normalized: &NormalizedData) -> bool {
    let msgs = &normalized.messages;
    if msgs.is_empty() {
        return false;
    }

    let mut sorted = msgs.clone();
    sorted.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    let last_msg = &sorted[0];

    if last_msg.role == "assistant" {
        let has_tool_calls = normalized
            .tool_calls
            .iter()
            .any(|tc| tc.message_id == last_msg.id);
        return has_tool_calls;
    }

    // Last message is from user -- check if tool results are still flowing
    let last_assistant = sorted.iter().find(|m| m.role == "assistant");
    let last_assistant = match last_assistant {
        Some(a) => a,
        None => return false,
    };

    let tool_calls_after = normalized
        .tool_calls
        .iter()
        .filter(|tc| tc.created_at >= last_assistant.created_at)
        .count();

    tool_calls_after > 0
        && normalized
            .tool_calls
            .iter()
            .any(|tc| tc.message_id == last_assistant.id)
}

// ── DB insert helpers ───────────────────────────────────────────────────

fn insert_conversation_data(
    tx: &rusqlite::Transaction,
    normalized: &NormalizedData,
) -> Result<(), rusqlite::Error> {
    let conv = &normalized.conversation;
    let status_str = if is_conversation_ongoing(normalized) {
        "active"
    } else {
        "completed"
    };

    tx.execute(
        "INSERT INTO conversations (id, agent, project, title, created_at, updated_at, model, status) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) \
         ON CONFLICT(id) DO UPDATE SET updated_at = ?6, status = ?8",
        rusqlite::params![
            conv.id,
            conv.agent,
            conv.project,
            conv.title,
            conv.created_at,
            conv.updated_at,
            conv.model,
            status_str,
        ],
    )?;

    for msg in &normalized.messages {
        tx.execute(
            "INSERT OR IGNORE INTO messages (id, conversation_id, role, content, thinking, created_at, model) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                msg.id,
                msg.conversation_id,
                msg.role,
                msg.content,
                msg.thinking,
                msg.created_at,
                msg.model,
            ],
        )?;
    }

    for tc in &normalized.tool_calls {
        let input_str = serde_json::to_string(&tc.input).unwrap_or_default();
        tx.execute(
            "INSERT INTO tool_calls (id, message_id, conversation_id, name, input, output, status, duration, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) \
             ON CONFLICT(id) DO UPDATE SET \
               output = COALESCE(excluded.output, tool_calls.output), \
               status = COALESCE(excluded.status, tool_calls.status), \
               duration = COALESCE(excluded.duration, tool_calls.duration)",
            rusqlite::params![
                tc.id,
                tc.message_id,
                tc.conversation_id,
                tc.name,
                input_str,
                tc.output,
                tc.status,
                tc.duration.map(|d| d as i64),
                tc.created_at,
            ],
        )?;
    }

    for tu in &normalized.token_usage {
        tx.execute(
            "INSERT OR IGNORE INTO token_usage (id, conversation_id, message_id, model, input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                tu.id,
                tu.conversation_id,
                tu.message_id,
                tu.model,
                tu.input_tokens,
                tu.output_tokens,
                tu.cache_read_tokens,
                tu.cache_creation_tokens,
                tu.created_at,
            ],
        )?;
    }

    for ce in &normalized.compaction_events {
        tx.execute(
            "INSERT OR IGNORE INTO compaction_events (id, conversation_id, timestamp, summary, tokens_before, tokens_after, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                ce.id,
                ce.conversation_id,
                ce.timestamp,
                ce.summary,
                ce.tokens_before,
                ce.tokens_after,
                ce.created_at,
            ],
        )?;
    }

    Ok(())
}

/// Extract plans from assistant messages and insert into plans/plan_steps tables.
fn insert_extracted_plans_sql(
    tx: &rusqlite::Transaction,
    normalized: &NormalizedData,
) -> Result<(), rusqlite::Error> {
    // Delete existing plans for this conversation
    let existing_plan_ids: Vec<String> = {
        let mut stmt = tx.prepare(
            "SELECT id FROM plans WHERE conversation_id = ?1",
        )?;
        let rows: Vec<String> = stmt.query_map(rusqlite::params![normalized.conversation.id], |row| {
            row.get::<_, String>(0)
        })?
        .filter_map(|r| r.ok())
        .collect();
        rows
    };

    for plan_id in &existing_plan_ids {
        tx.execute(
            "DELETE FROM plan_steps WHERE plan_id = ?1",
            rusqlite::params![plan_id],
        )?;
    }
    if !existing_plan_ids.is_empty() {
        tx.execute(
            "DELETE FROM plans WHERE conversation_id = ?1",
            rusqlite::params![normalized.conversation.id],
        )?;
    }

    // Extract plans from ExitPlanMode tool calls only
    let extracted = extract_plans_from_tool_calls(&normalized.tool_calls, normalized.conversation.title.as_deref());

    for plan in &extracted {
        // Find the source message's created_at for completion context
        let source_msg = normalized.messages.iter().find(|m| m.id == plan.source_message_id);
        let source_created_at = source_msg.map(|m| m.created_at.as_str()).unwrap_or("");

        // Build completion context from messages after the plan source
        let later_messages: Vec<LaterMessage> = normalized
            .messages
            .iter()
            .filter(|m| m.created_at.as_str() > source_created_at)
            .map(|m| LaterMessage {
                role: m.role.clone(),
                content: m.content.clone(),
            })
            .collect();
        let tool_call_refs: Vec<ToolCallRef> = normalized
            .tool_calls
            .iter()
            .map(|tc| ToolCallRef {
                name: tc.name.clone(),
                input: tc.input.clone(),
                status: tc.status.clone(),
            })
            .collect();
        let context = CompletionContext {
            later_messages,
            tool_calls: tool_call_refs,
        };

        let steps_with_status: Vec<_> = plan
            .steps
            .iter()
            .map(|s| {
                let status = infer_step_completion(s, &context);
                (s, status)
            })
            .collect();

        let completed_count = steps_with_status
            .iter()
            .filter(|(_, s)| *s == "complete")
            .count();
        let plan_status = if completed_count == plan.steps.len() {
            "complete"
        } else if completed_count == 0 {
            if steps_with_status.iter().any(|(_, s)| *s == "incomplete") {
                "not-started"
            } else {
                "unknown"
            }
        } else {
            "partial"
        };

        let plan_id = generate_id(&[
            &normalized.conversation.id,
            "plan",
            &plan.source_message_id,
            &plan.title,
        ]);

        let plan_created_at = source_msg.map(|m| m.created_at.as_str()).unwrap_or(&normalized.conversation.created_at);

        tx.execute(
            "INSERT OR IGNORE INTO plans (id, conversation_id, source_message_id, title, total_steps, completed_steps, status, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                plan_id,
                normalized.conversation.id,
                plan.source_message_id,
                plan.title,
                plan.steps.len() as i64,
                completed_count as i64,
                plan_status,
                plan_created_at,
            ],
        )?;

        for (step, status) in &steps_with_status {
            let step_id = generate_id(&[&plan_id, &step.step_number.to_string()]);
            tx.execute(
                "INSERT OR IGNORE INTO plan_steps (id, plan_id, step_number, content, status, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    step_id,
                    plan_id,
                    step.step_number as i64,
                    step.content,
                    status,
                    plan_created_at,
                ],
            )?;
        }
    }

    Ok(())
}
