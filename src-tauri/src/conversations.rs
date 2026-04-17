use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio_rusqlite::rusqlite::params;

use crate::error::AppError;
use crate::pricing::{self, CostResult};
use crate::server::AppState;

// ── Route Registration ──────────────────────────────────────────────

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/analytics/conversations/{id}", get(conversation_detail))
        .route("/api/analytics/conversations", get(conversation_list))
}

// ── Query Params ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ConversationListParams {
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub agent: Option<String>,
    pub project: Option<String>,
    pub search: Option<String>,
    /// Filter by parent_conversation_id link.
    /// `Some("primary")` or `None` (default): only top-level conversations (back-compat).
    /// `Some("subagent")`: only sub-agent conversations.
    /// `Some("all")`: no filter (both primary and sub-agents, flat).
    pub kind: Option<String>,
}

// ── Response Structs ────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConversationRow {
    pub id: String,
    pub date: String,
    pub agent: String,
    pub title: Option<String>,
    pub project: Option<String>,
    pub model: Option<String>,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_creation_tokens: i64,
    pub cost: Option<f64>,
    pub savings: Option<f64>,
    pub is_active: bool,
    pub has_compaction: bool,
    pub parent_conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<ChildConversationRow>>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChildConversationRow {
    pub id: String,
    pub date: String,
    pub agent: String,
    pub title: Option<String>,
    pub project: Option<String>,
    pub model: Option<String>,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_creation_tokens: i64,
    pub cost: Option<f64>,
    pub savings: Option<f64>,
    pub is_active: bool,
    pub has_compaction: bool,
    pub parent_conversation_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationListResponse {
    pub rows: Vec<ConversationRow>,
    pub total: i64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchConversationRow {
    pub id: String,
    pub date: String,
    pub agent: String,
    pub title: Option<String>,
    pub project: Option<String>,
    pub model: Option<String>,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_creation_tokens: i64,
    pub cost: Option<f64>,
    pub savings: Option<f64>,
    pub is_active: bool,
    pub has_compaction: bool,
    pub parent_conversation_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<ChildConversationRow>>,
    pub snippet: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchConversationListResponse {
    pub rows: Vec<SearchConversationRow>,
    pub total: i64,
    pub page: u32,
    pub limit: u32,
    pub query: String,
}

// ── Conversation Detail Response Structs ────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationDetailResponse {
    pub conversation: ConversationInfo,
    pub messages: Vec<MessageRow>,
    pub tool_calls: Vec<ToolCallRow>,
    pub token_summary: TokenSummary,
    pub token_usage_by_message: HashMap<String, MessageTokenUsage>,
    pub compaction_events: Vec<CompactionEvent>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationInfo {
    pub id: String,
    pub agent: String,
    pub project: Option<String>,
    pub title: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub model: Option<String>,
    pub first_message_at: Option<String>,
    pub last_message_at: Option<String>,
    pub parent_conversation_id: Option<String>,
    pub parent_title: Option<String>,
    pub is_active: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageRow {
    pub id: String,
    pub role: String,
    pub content: Option<String>,
    pub thinking: Option<String>,
    pub created_at: String,
    pub model: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallRow {
    pub id: String,
    pub message_id: String,
    pub name: String,
    pub input: Option<serde_json::Value>,
    pub output: Option<serde_json::Value>,
    pub status: Option<String>,
    pub duration: Option<i64>,
    pub created_at: String,
    pub subagent_conversation_id: Option<String>,
    pub subagent_summary: Option<serde_json::Value>,
    pub subagent_link_attempted: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenSummary {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_creation_tokens: i64,
    pub cost: Option<f64>,
    pub savings: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageTokenUsage {
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub cache_creation_tokens: i64,
    pub cost: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactionEvent {
    pub id: String,
    pub timestamp: String,
    pub summary: Option<String>,
    pub tokens_before: Option<i64>,
    pub tokens_after: Option<i64>,
}

// ── Internal structs for query results ──────────────────────────────

struct RawConvRow {
    id: String,
    date: String,
    agent: String,
    title: Option<String>,
    project: Option<String>,
    model: Option<String>,
    input_tokens: i64,
    output_tokens: i64,
    cache_read_tokens: i64,
    cache_creation_tokens: i64,
    is_active: bool,
    has_compaction: bool,
    parent_conversation_id: Option<String>,
}

struct PerModelTokenRow {
    conversation_id: String,
    model: String,
    input_tokens: i64,
    output_tokens: i64,
    cache_read_tokens: i64,
    cache_creation_tokens: i64,
}

// ── Conversation List Handler ───────────────────────────────────────

async fn conversation_list(
    State(state): State<AppState>,
    Query(params): Query<ConversationListParams>,
) -> Result<Json<serde_json::Value>, AppError> {
    let from = params.from.unwrap_or_else(|| {
        (chrono::Utc::now() - chrono::Duration::days(30))
            .format("%Y-%m-%d")
            .to_string()
    });
    let to = params.to.unwrap_or_else(|| {
        chrono::Utc::now().format("%Y-%m-%d").to_string()
    });
    let page = params.page.unwrap_or(1);
    let limit = params.limit.unwrap_or(20);
    let sort = params.sort.unwrap_or_else(|| "date".to_string());
    let order = params.order.unwrap_or_else(|| "desc".to_string());
    let agent = params.agent;
    let project = params.project;
    let search = params.search;
    let kind = params.kind;

    let to_with_time = format!("{}T23:59:59Z", to);
    let is_cost_sort = sort == "cost";
    let offset = ((page - 1) * limit) as i64;

    // Clone values for the closure
    let from_c = from.clone();
    let to_c = to_with_time.clone();
    let agent_c = agent.clone();
    let project_c = project.clone();
    let search_c = search.clone();
    let sort_c = sort.clone();
    let order_c = order.clone();
    let kind_c = kind.clone();

    // Main query: conversation rows + total count + per-model tokens
    let (rows, total, per_model_tokens) = state
        .db
        .call(move |conn| {
            // Build WHERE clause dynamically
            let mut conditions = vec![
                "c.created_at >= ?".to_string(),
                "c.created_at <= ?".to_string(),
            ];
            let mut bind_values: Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql>> = vec![
                Box::new(from_c.clone()),
                Box::new(to_c.clone()),
            ];

            if let Some(ref agent_val) = agent_c {
                conditions.push("c.agent = ?".to_string());
                bind_values.push(Box::new(agent_val.clone()));
            }
            if let Some(ref project_val) = project_c {
                conditions.push("c.project = ?".to_string());
                bind_values.push(Box::new(project_val.clone()));
            }

            // Search filter — LIKE on title/project/model/messages plus FTS on subagent_fts (IMPR-6).
            if let Some(ref search_val) = search_c {
                let pattern = format!("%{}%", search_val);
                // FTS5 prefix-match query: lowercase + escape double-quotes by stripping them.
                // (FTS5 phrase syntax: "term"* matches term-prefixed tokens.)
                let fts_query = format!(
                    "\"{}\"*",
                    search_val.to_lowercase().replace('"', "")
                );
                conditions.push(format!(
                    "(c.title LIKE ? OR c.project LIKE ? OR c.model LIKE ? \
                      OR c.id IN (SELECT DISTINCT conversation_id FROM messages WHERE content LIKE ?) \
                      OR c.id IN (SELECT DISTINCT tc.conversation_id FROM tool_calls tc \
                                  JOIN subagent_fts s ON s.tool_call_id = tc.id \
                                  WHERE s.content MATCH ?))"
                ));
                bind_values.push(Box::new(pattern.clone()));
                bind_values.push(Box::new(pattern.clone()));
                bind_values.push(Box::new(pattern.clone()));
                bind_values.push(Box::new(pattern));
                bind_values.push(Box::new(fts_query));
            }

            // Filter by kind: primary (default, back-compat) / subagent / all.
            // Unknown values fall through to primary-only for safety.
            match kind_c.as_deref() {
                Some("all") => {} // no parent filter
                Some("subagent") => {
                    conditions.push("c.parent_conversation_id IS NOT NULL".to_string());
                }
                Some("primary") | None | Some(_) => {
                    conditions.push("c.parent_conversation_id IS NULL".to_string());
                }
            }
            conditions.push("EXISTS (SELECT 1 FROM messages WHERE messages.conversation_id = c.id AND messages.role = 'assistant')".to_string());

            let where_clause = conditions.join(" AND ");

            // Map sort field to SQL expression
            let sort_expr = match sort_c.as_str() {
                "date" => "c.created_at".to_string(),
                "updated" => "c.updated_at".to_string(),
                "agent" => "c.agent".to_string(),
                "project" => "c.project".to_string(),
                "model" => "c.model".to_string(),
                "title" => "c.title".to_string(),
                "inputTokens" => "COALESCE(SUM(tu.input_tokens), 0) + COALESCE(SUM(tu.output_tokens), 0)".to_string(),
                "cacheReadTokens" => "COALESCE(SUM(tu.cache_read_tokens), 0)".to_string(),
                "cost" => "c.created_at".to_string(), // Cost sort happens in Rust
                _ => "c.created_at".to_string(),
            };

            let nullable_columns = ["agent", "project", "model", "title"];
            let is_nullable = nullable_columns.contains(&sort_c.as_str());

            let order_dir = if order_c == "asc" { "ASC" } else { "DESC" };

            let order_clause = if is_nullable {
                format!(
                    "CASE WHEN {} IS NULL THEN 1 ELSE 0 END ASC, {} {}",
                    sort_expr, sort_expr, order_dir
                )
            } else {
                format!("{} {}", sort_expr, order_dir)
            };

            let pagination_clause = if is_cost_sort {
                String::new()
            } else {
                format!("LIMIT {} OFFSET {}", limit, offset)
            };

            let sql = format!(
                "SELECT
                    c.id,
                    c.created_at as date,
                    c.agent,
                    c.title,
                    c.project,
                    c.model,
                    COALESCE(SUM(tu.input_tokens), 0) as input_tokens,
                    COALESCE(SUM(tu.output_tokens), 0) as output_tokens,
                    COALESCE(SUM(tu.cache_read_tokens), 0) as cache_read_tokens,
                    COALESCE(SUM(tu.cache_creation_tokens), 0) as cache_creation_tokens,
                    CASE WHEN c.status = 'active' THEN 1 ELSE 0 END as is_active,
                    EXISTS (SELECT 1 FROM compaction_events WHERE compaction_events.conversation_id = c.id) as has_compaction,
                    c.parent_conversation_id
                FROM conversations c
                LEFT JOIN token_usage tu ON tu.conversation_id = c.id
                WHERE {}
                GROUP BY c.id
                ORDER BY {}
                {}",
                where_clause, order_clause, pagination_clause
            );

            let params_refs: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                bind_values.iter().map(|b| b.as_ref()).collect();

            let mut stmt = conn.prepare(&sql)?;
            let rows: Vec<RawConvRow> = stmt
                .query_map(params_refs.as_slice(), |row| {
                    Ok(RawConvRow {
                        id: row.get(0)?,
                        date: row.get(1)?,
                        agent: row.get(2)?,
                        title: row.get(3)?,
                        project: row.get(4)?,
                        model: row.get(5)?,
                        input_tokens: row.get(6)?,
                        output_tokens: row.get(7)?,
                        cache_read_tokens: row.get(8)?,
                        cache_creation_tokens: row.get(9)?,
                        is_active: row.get::<_, i64>(10)? == 1,
                        has_compaction: row.get::<_, i64>(11)? == 1,
                        parent_conversation_id: row.get(12)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            // Total count query with same filters
            let count_sql = format!(
                "SELECT count(*) FROM conversations c WHERE {}",
                where_clause
            );
            let total: i64 = conn.query_row(
                &count_sql,
                params_refs.as_slice(),
                |row| row.get(0),
            )?;

            // Per-model token query for cost calculation
            let conv_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
            let per_model_tokens = if !conv_ids.is_empty() {
                let placeholders: String = conv_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                let pm_sql = format!(
                    "SELECT conversation_id, model, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, SUM(cache_read_tokens) as cache_read_tokens, SUM(cache_creation_tokens) as cache_creation_tokens
                     FROM token_usage
                     WHERE conversation_id IN ({})
                     GROUP BY conversation_id, model",
                    placeholders
                );
                let pm_params: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                    conv_ids.iter().map(|s| s as &dyn tokio_rusqlite::rusqlite::types::ToSql).collect();
                let mut pm_stmt = conn.prepare(&pm_sql)?;
                let result = pm_stmt
                    .query_map(pm_params.as_slice(), |row| {
                        Ok(PerModelTokenRow {
                            conversation_id: row.get(0)?,
                            model: row.get(1)?,
                            input_tokens: row.get(2)?,
                            output_tokens: row.get(3)?,
                            cache_read_tokens: row.get(4)?,
                            cache_creation_tokens: row.get(5)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                result
            } else {
                vec![]
            };

            Ok((rows, total, per_model_tokens))
        })
        .await?;

    // Build cost map from per-model tokens
    let mut cost_by_conv: HashMap<String, (f64, f64)> = HashMap::new();
    for pm in &per_model_tokens {
        if let Some(cr) = pricing::calculate_cost(
            &pm.model,
            pm.input_tokens,
            pm.output_tokens,
            pm.cache_read_tokens,
            pm.cache_creation_tokens,
        ) {
            let entry = cost_by_conv.entry(pm.conversation_id.clone()).or_insert((0.0, 0.0));
            entry.0 += cr.cost;
            entry.1 += cr.savings;
        }
    }

    // Fetch children and their costs in a second db.call()
    let parent_ids: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
    let from_c2 = from.clone();
    let to_c2 = to_with_time.clone();
    let agent_c2 = agent.clone();

    let (child_rows, child_per_model_tokens) = if !parent_ids.is_empty() {
        state.db.call(move |conn| {
            let mut conditions = vec![
                "c.created_at >= ?".to_string(),
                "c.created_at <= ?".to_string(),
            ];
            let mut bind_values: Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql>> = vec![
                Box::new(from_c2),
                Box::new(to_c2),
            ];

            if let Some(ref agent_val) = agent_c2 {
                conditions.push("c.agent = ?".to_string());
                bind_values.push(Box::new(agent_val.clone()));
            }

            // Children of current page parents
            let placeholders: String = parent_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            conditions.push(format!("c.parent_conversation_id IN ({})", placeholders));
            for pid in &parent_ids {
                bind_values.push(Box::new(pid.clone()));
            }

            conditions.push("EXISTS (SELECT 1 FROM messages WHERE messages.conversation_id = c.id AND messages.role = 'assistant')".to_string());

            let where_clause = conditions.join(" AND ");

            let sql = format!(
                "SELECT
                    c.id,
                    c.created_at as date,
                    c.agent,
                    c.title,
                    c.project,
                    c.model,
                    COALESCE(SUM(tu.input_tokens), 0) as input_tokens,
                    COALESCE(SUM(tu.output_tokens), 0) as output_tokens,
                    COALESCE(SUM(tu.cache_read_tokens), 0) as cache_read_tokens,
                    COALESCE(SUM(tu.cache_creation_tokens), 0) as cache_creation_tokens,
                    CASE WHEN c.status = 'active' THEN 1 ELSE 0 END as is_active,
                    EXISTS (SELECT 1 FROM compaction_events WHERE compaction_events.conversation_id = c.id) as has_compaction,
                    c.parent_conversation_id
                FROM conversations c
                LEFT JOIN token_usage tu ON tu.conversation_id = c.id
                WHERE {}
                GROUP BY c.id
                ORDER BY c.created_at ASC",
                where_clause
            );

            let params_refs: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                bind_values.iter().map(|b| b.as_ref()).collect();

            let mut stmt = conn.prepare(&sql)?;
            let child_rows: Vec<RawConvRow> = stmt
                .query_map(params_refs.as_slice(), |row| {
                    Ok(RawConvRow {
                        id: row.get(0)?,
                        date: row.get(1)?,
                        agent: row.get(2)?,
                        title: row.get(3)?,
                        project: row.get(4)?,
                        model: row.get(5)?,
                        input_tokens: row.get(6)?,
                        output_tokens: row.get(7)?,
                        cache_read_tokens: row.get(8)?,
                        cache_creation_tokens: row.get(9)?,
                        is_active: row.get::<_, i64>(10)? == 1,
                        has_compaction: row.get::<_, i64>(11)? == 1,
                        parent_conversation_id: row.get(12)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            // Per-model tokens for children
            let child_ids: Vec<String> = child_rows.iter().map(|r| r.id.clone()).collect();
            let child_pm = if !child_ids.is_empty() {
                let cph: String = child_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
                let pm_sql = format!(
                    "SELECT conversation_id, model, SUM(input_tokens), SUM(output_tokens), SUM(cache_read_tokens), SUM(cache_creation_tokens)
                     FROM token_usage WHERE conversation_id IN ({}) GROUP BY conversation_id, model",
                    cph
                );
                let pm_params: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                    child_ids.iter().map(|s| s as &dyn tokio_rusqlite::rusqlite::types::ToSql).collect();
                let mut pm_stmt = conn.prepare(&pm_sql)?;
                let result = pm_stmt
                    .query_map(pm_params.as_slice(), |row| {
                        Ok(PerModelTokenRow {
                            conversation_id: row.get(0)?,
                            model: row.get(1)?,
                            input_tokens: row.get(2)?,
                            output_tokens: row.get(3)?,
                            cache_read_tokens: row.get(4)?,
                            cache_creation_tokens: row.get(5)?,
                        })
                    })?
                    .collect::<Result<Vec<_>, _>>()?;
                result
            } else {
                vec![]
            };

            Ok((child_rows, child_pm))
        })
        .await?
    } else {
        (vec![], vec![])
    };

    // Add child costs to cost map
    for pm in &child_per_model_tokens {
        if let Some(cr) = pricing::calculate_cost(
            &pm.model,
            pm.input_tokens,
            pm.output_tokens,
            pm.cache_read_tokens,
            pm.cache_creation_tokens,
        ) {
            let entry = cost_by_conv.entry(pm.conversation_id.clone()).or_insert((0.0, 0.0));
            entry.0 += cr.cost;
            entry.1 += cr.savings;
        }
    }

    // Group children by parent
    let mut children_map: HashMap<String, Vec<RawConvRow>> = HashMap::new();
    for child in child_rows {
        if let Some(ref pid) = child.parent_conversation_id {
            children_map.entry(pid.clone()).or_default().push(child);
        }
    }

    // Build ConversationRow objects
    let build_conv_row = |raw: &RawConvRow, children: Option<Vec<ChildConversationRow>>| -> ConversationRow {
        let cost_data = cost_by_conv.get(&raw.id);
        ConversationRow {
            id: raw.id.clone(),
            date: raw.date.clone(),
            agent: raw.agent.clone(),
            title: raw.title.clone(),
            project: raw.project.clone(),
            model: raw.model.clone(),
            input_tokens: raw.input_tokens,
            output_tokens: raw.output_tokens,
            cache_read_tokens: raw.cache_read_tokens,
            cache_creation_tokens: raw.cache_creation_tokens,
            cost: cost_data.map(|c| c.0),
            savings: cost_data.map(|c| c.1),
            is_active: raw.is_active,
            has_compaction: raw.has_compaction,
            parent_conversation_id: raw.parent_conversation_id.clone(),
            parent_title: None,
            children,
        }
    };

    let build_child_conv_row = |raw: &RawConvRow| -> ChildConversationRow {
        let cost_data = cost_by_conv.get(&raw.id);
        ChildConversationRow {
            id: raw.id.clone(),
            date: raw.date.clone(),
            agent: raw.agent.clone(),
            title: raw.title.clone(),
            project: raw.project.clone(),
            model: raw.model.clone(),
            input_tokens: raw.input_tokens,
            output_tokens: raw.output_tokens,
            cache_read_tokens: raw.cache_read_tokens,
            cache_creation_tokens: raw.cache_creation_tokens,
            cost: cost_data.map(|c| c.0),
            savings: cost_data.map(|c| c.1),
            is_active: raw.is_active,
            has_compaction: raw.has_compaction,
            parent_conversation_id: raw.parent_conversation_id.clone(),
        }
    };

    // For search mode, we need snippets
    let has_search = search.is_some();

    if has_search {
        let search_term = search.clone().unwrap();
        let search_term_c = search_term.clone();

        // Fetch snippets for all conversation IDs
        let conv_ids_for_snippets: Vec<String> = rows.iter().map(|r| r.id.clone()).collect();
        let snippets = if !conv_ids_for_snippets.is_empty() {
            state.db.call(move |conn| {
                let mut snippet_map: HashMap<String, Option<String>> = HashMap::new();
                for cid in &conv_ids_for_snippets {
                    let result: Option<String> = conn
                        .query_row(
                            "SELECT content FROM messages WHERE conversation_id = ? AND content LIKE ? LIMIT 1",
                            params![cid, format!("%{}%", search_term_c)],
                            |row| row.get(0),
                        )
                        .ok();
                    let snippet = result.and_then(|content| extract_snippet(&content, &search_term_c, 100));
                    snippet_map.insert(cid.clone(), snippet);
                }
                Ok(snippet_map)
            })
            .await?
        } else {
            HashMap::new()
        };

        let mut search_rows: Vec<SearchConversationRow> = rows
            .iter()
            .map(|raw| {
                let child_convs = children_map.remove(&raw.id).map(|children| {
                    children
                        .iter()
                        .map(|c| build_child_conv_row(c))
                        .collect::<Vec<_>>()
                });
                let children = match child_convs {
                    Some(ref v) if v.is_empty() => None,
                    other => other,
                };
                let base = build_conv_row(raw, children);
                let snippet = snippets.get(&raw.id).cloned().flatten();

                SearchConversationRow {
                    id: base.id,
                    date: base.date,
                    agent: base.agent,
                    title: base.title,
                    project: base.project,
                    model: base.model,
                    input_tokens: base.input_tokens,
                    output_tokens: base.output_tokens,
                    cache_read_tokens: base.cache_read_tokens,
                    cache_creation_tokens: base.cache_creation_tokens,
                    cost: base.cost,
                    savings: base.savings,
                    is_active: base.is_active,
                    has_compaction: base.has_compaction,
                    parent_conversation_id: base.parent_conversation_id,
                    parent_title: base.parent_title,
                    children: base.children,
                    snippet,
                }
            })
            .collect();

        // Cost sort in Rust
        if is_cost_sort {
            let sort_dir: f64 = if order == "asc" { 1.0 } else { -1.0 };
            search_rows.sort_by(|a, b| {
                match (a.cost, b.cost) {
                    (None, None) => std::cmp::Ordering::Equal,
                    (None, Some(_)) => std::cmp::Ordering::Greater,
                    (Some(_), None) => std::cmp::Ordering::Less,
                    (Some(ac), Some(bc)) => {
                        let diff = (ac - bc) * sort_dir;
                        if diff < 0.0 {
                            std::cmp::Ordering::Less
                        } else if diff > 0.0 {
                            std::cmp::Ordering::Greater
                        } else {
                            std::cmp::Ordering::Equal
                        }
                    }
                }
            });
            let start = offset as usize;
            let end = std::cmp::min(start + limit as usize, search_rows.len());
            let paginated = if start < search_rows.len() {
                search_rows[start..end].to_vec()
            } else {
                vec![]
            };
            return Ok(Json(serde_json::to_value(SearchConversationListResponse {
                rows: paginated,
                total,
                page,
                limit,
                query: search_term,
            })?));
        }

        return Ok(Json(serde_json::to_value(SearchConversationListResponse {
            rows: search_rows,
            total,
            page,
            limit,
            query: search_term,
        })?));
    }

    // Non-search path
    let mut conversation_rows: Vec<ConversationRow> = rows
        .iter()
        .map(|raw| {
            let child_convs = children_map.remove(&raw.id).map(|children| {
                children
                    .iter()
                    .map(|c| build_child_conv_row(c))
                    .collect::<Vec<_>>()
            });
            let children = match child_convs {
                Some(ref v) if v.is_empty() => None,
                other => other,
            };
            build_conv_row(raw, children)
        })
        .collect();

    // Cost sort in Rust
    if is_cost_sort {
        let sort_dir: f64 = if order == "asc" { 1.0 } else { -1.0 };
        conversation_rows.sort_by(|a, b| {
            match (a.cost, b.cost) {
                (None, None) => std::cmp::Ordering::Equal,
                (None, Some(_)) => std::cmp::Ordering::Greater,
                (Some(_), None) => std::cmp::Ordering::Less,
                (Some(ac), Some(bc)) => {
                    let diff = (ac - bc) * sort_dir;
                    if diff < 0.0 {
                        std::cmp::Ordering::Less
                    } else if diff > 0.0 {
                        std::cmp::Ordering::Greater
                    } else {
                        std::cmp::Ordering::Equal
                    }
                }
            }
        });
        let start = offset as usize;
        let end = std::cmp::min(start + limit as usize, conversation_rows.len());
        let paginated = if start < conversation_rows.len() {
            conversation_rows[start..end].to_vec()
        } else {
            vec![]
        };
        return Ok(Json(serde_json::to_value(ConversationListResponse {
            rows: paginated,
            total,
            page,
            limit,
        })?));
    }

    Ok(Json(serde_json::to_value(ConversationListResponse {
        rows: conversation_rows,
        total,
        page,
        limit,
    })?))
}

// ── Search Snippet Extraction ───────────────────────────────────────

fn extract_snippet(content: &str, search_term: &str, context_chars: usize) -> Option<String> {
    let lower_content = content.to_lowercase();
    let lower_term = search_term.to_lowercase();
    let idx = lower_content.find(&lower_term)?;

    let start = if idx > context_chars { idx - context_chars } else { 0 };
    let end = std::cmp::min(content.len(), idx + search_term.len() + context_chars);

    let mut snippet = String::new();
    if start > 0 {
        snippet.push_str("...");
    }
    snippet.push_str(&content[start..idx]);
    snippet.push_str("<mark>");
    snippet.push_str(&content[idx..idx + search_term.len()]);
    snippet.push_str("</mark>");
    snippet.push_str(&content[idx + search_term.len()..end]);
    if end < content.len() {
        snippet.push_str("...");
    }

    Some(snippet)
}

// ── Conversation Detail Handler ─────────────────────────────────────

async fn conversation_detail(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ConversationDetailResponse>, AppError> {
    let conv_id = id.clone();

    let result = state
        .db
        .call(move |conn| {
            // 1. Fetch conversation row
            let conv = conn.query_row(
                "SELECT id, agent, project, title, created_at, updated_at, model, status, parent_conversation_id FROM conversations WHERE id = ?",
                params![conv_id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,    // id
                        row.get::<_, String>(1)?,    // agent
                        row.get::<_, Option<String>>(2)?, // project
                        row.get::<_, Option<String>>(3)?, // title
                        row.get::<_, String>(4)?,    // created_at
                        row.get::<_, String>(5)?,    // updated_at
                        row.get::<_, Option<String>>(6)?, // model
                        row.get::<_, String>(7)?,    // status
                        row.get::<_, Option<String>>(8)?, // parent_conversation_id
                    ))
                },
            );

            let conv = match conv {
                Ok(c) => c,
                Err(tokio_rusqlite::rusqlite::Error::QueryReturnedNoRows) => {
                    return Ok(None);
                }
                Err(e) => return Err(e.into()),
            };

            let (c_id, c_agent, c_project, c_title, c_created_at, c_updated_at, c_model, c_status, c_parent_id) = conv;

            // 2. Fetch messages
            let mut msg_stmt = conn.prepare(
                "SELECT id, role, content, thinking, created_at, model FROM messages WHERE conversation_id = ? ORDER BY created_at"
            )?;
            let messages: Vec<MessageRow> = msg_stmt
                .query_map(params![c_id], |row| {
                    Ok(MessageRow {
                        id: row.get(0)?,
                        role: row.get(1)?,
                        content: row.get(2)?,
                        thinking: row.get(3)?,
                        created_at: row.get(4)?,
                        model: row.get(5)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            // 3. Fetch tool calls
            let mut tc_stmt = conn.prepare(
                "SELECT id, message_id, name, input, output, status, duration, created_at, subagent_conversation_id, subagent_summary, subagent_link_attempted FROM tool_calls WHERE conversation_id = ? ORDER BY created_at"
            )?;
            let tool_calls: Vec<ToolCallRow> = tc_stmt
                .query_map(params![c_id], |row| {
                    let input_str: Option<String> = row.get(3)?;
                    let output_str: Option<String> = row.get(4)?;
                    let subagent_summary_str: Option<String> = row.get(9)?;
                    let subagent_link_attempted: i64 = row.get(10)?;

                    let input = input_str.and_then(|s| serde_json::from_str(&s).ok());
                    let output = output_str.and_then(|s| serde_json::from_str(&s).ok());
                    let subagent_summary = subagent_summary_str.and_then(|s| serde_json::from_str(&s).ok());

                    Ok(ToolCallRow {
                        id: row.get(0)?,
                        message_id: row.get(1)?,
                        name: row.get(2)?,
                        input,
                        output,
                        status: row.get(5)?,
                        duration: row.get(6)?,
                        created_at: row.get(7)?,
                        subagent_conversation_id: row.get(8)?,
                        subagent_summary,
                        subagent_link_attempted: subagent_link_attempted != 0,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            // 4. Token summary grouped by model
            let mut ts_stmt = conn.prepare(
                "SELECT model, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, SUM(cache_read_tokens) as cache_read_tokens, SUM(cache_creation_tokens) as cache_creation_tokens FROM token_usage WHERE conversation_id = ? GROUP BY model"
            )?;

            struct TokenModelRow {
                model: String,
                input_tokens: i64,
                output_tokens: i64,
                cache_read_tokens: i64,
                cache_creation_tokens: i64,
            }

            let token_rows: Vec<TokenModelRow> = ts_stmt
                .query_map(params![c_id], |row| {
                    Ok(TokenModelRow {
                        model: row.get(0)?,
                        input_tokens: row.get(1)?,
                        output_tokens: row.get(2)?,
                        cache_read_tokens: row.get(3)?,
                        cache_creation_tokens: row.get(4)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            let mut total_input: i64 = 0;
            let mut total_output: i64 = 0;
            let mut total_cache_read: i64 = 0;
            let mut total_cache_creation: i64 = 0;
            let mut total_cost: f64 = 0.0;
            let mut total_savings: f64 = 0.0;
            let mut has_cost = false;

            for tr in &token_rows {
                total_input += tr.input_tokens;
                total_output += tr.output_tokens;
                total_cache_read += tr.cache_read_tokens;
                total_cache_creation += tr.cache_creation_tokens;

                if let Some(cr) = pricing::calculate_cost(
                    &tr.model,
                    tr.input_tokens,
                    tr.output_tokens,
                    tr.cache_read_tokens,
                    tr.cache_creation_tokens,
                ) {
                    has_cost = true;
                    total_cost += cr.cost;
                    total_savings += cr.savings;
                }
            }

            // 5. Per-message token usage
            let mut pm_stmt = conn.prepare(
                "SELECT message_id, model, SUM(input_tokens), SUM(output_tokens), SUM(cache_read_tokens), SUM(cache_creation_tokens) FROM token_usage WHERE conversation_id = ? AND message_id IS NOT NULL GROUP BY message_id"
            )?;

            let mut token_usage_by_message: HashMap<String, MessageTokenUsage> = HashMap::new();
            let per_msg_rows = pm_stmt.query_map(params![c_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                ))
            })?;

            for row_result in per_msg_rows {
                let (msg_id, model, inp, out, cr, cc) = row_result?;
                let cost_result = pricing::calculate_cost(&model, inp, out, cr, cc);
                token_usage_by_message.insert(
                    msg_id,
                    MessageTokenUsage {
                        input_tokens: inp,
                        output_tokens: out,
                        cache_read_tokens: cr,
                        cache_creation_tokens: cc,
                        cost: cost_result.map(|c| c.cost),
                    },
                );
            }

            // 6. Compaction events
            let mut ce_stmt = conn.prepare(
                "SELECT id, timestamp, summary, tokens_before, tokens_after FROM compaction_events WHERE conversation_id = ? ORDER BY timestamp"
            )?;
            let compaction_events: Vec<CompactionEvent> = ce_stmt
                .query_map(params![c_id], |row| {
                    Ok(CompactionEvent {
                        id: row.get(0)?,
                        timestamp: row.get(1)?,
                        summary: row.get(2)?,
                        tokens_before: row.get(3)?,
                        tokens_after: row.get(4)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            // 7. First/last message times
            let first_message_at = messages.first().map(|m| m.created_at.clone()).unwrap_or_else(|| c_created_at.clone());
            let last_message_at = messages.last().map(|m| m.created_at.clone()).unwrap_or_else(|| c_updated_at.clone());

            // 8. Parent title lookup
            let parent_title = if let Some(ref pid) = c_parent_id {
                conn.query_row(
                    "SELECT title FROM conversations WHERE id = ?",
                    params![pid],
                    |row| row.get::<_, Option<String>>(0),
                )
                .ok()
                .flatten()
            } else {
                None
            };

            let response = ConversationDetailResponse {
                conversation: ConversationInfo {
                    id: c_id,
                    agent: c_agent,
                    project: c_project,
                    title: c_title,
                    created_at: c_created_at,
                    updated_at: c_updated_at,
                    model: c_model,
                    first_message_at: Some(first_message_at),
                    last_message_at: Some(last_message_at),
                    parent_conversation_id: c_parent_id,
                    parent_title,
                    is_active: c_status == "active",
                },
                messages,
                tool_calls,
                token_summary: TokenSummary {
                    input_tokens: total_input,
                    output_tokens: total_output,
                    cache_read_tokens: total_cache_read,
                    cache_creation_tokens: total_cache_creation,
                    cost: if has_cost { Some(total_cost) } else { None },
                    savings: if has_cost { Some(total_savings) } else { None },
                },
                token_usage_by_message,
                compaction_events,
            };

            Ok(Some(response))
        })
        .await?;

    match result {
        Some(response) => Ok(Json(response)),
        None => Err(AppError::NotFound("Conversation not found".to_string())),
    }
}
