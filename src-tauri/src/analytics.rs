use axum::{extract::Query, extract::State, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio_rusqlite::params;

use crate::error::AppError;
use crate::extractors::DateRangeParams;
use crate::pricing;
use crate::server::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/analytics/overview", get(overview))
        .route("/api/analytics/timeseries", get(timeseries))
        .route("/api/analytics/model-distribution", get(model_distribution))
        .route("/api/analytics/tool-stats", get(tool_stats))
        .route("/api/analytics/heatmap", get(heatmap))
        .route("/api/analytics/project-stats", get(project_stats))
        .route("/api/analytics/token-rate", get(token_rate))
        .route("/api/analytics/filters", get(filters))
}

// ── Response Structs ──────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OverviewStats {
    total_tokens: i64,
    total_input: i64,
    total_output: i64,
    total_cache_read: i64,
    total_cache_creation: i64,
    estimated_cost: f64,
    total_savings: f64,
    conversation_count: i64,
    active_days: i64,
    trends: OverviewTrends,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OverviewTrends {
    tokens_trend: Option<f64>,
    cost_trend: Option<f64>,
    conversations_trend: Option<f64>,
    active_days_trend: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TimeSeriesPoint {
    period: String,
    input_tokens: i64,
    output_tokens: i64,
    cache_read_tokens: i64,
    cache_creation_tokens: i64,
    cost: f64,
    conversation_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelDistributionEntry {
    model: String,
    count: i64,
    total_tokens: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ToolStatsRow {
    name: String,
    total: i64,
    success: i64,
    failure: i64,
    unknown: i64,
    rejected: i64,
    avg_duration: Option<f64>,
    p95_duration: Option<f64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HeatmapDay {
    date: String,
    count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectStatsRow {
    project: String,
    conversation_count: i64,
    last_active: String,
    total_tokens: i64,
    total_cost: f64,
    total_input: i64,
    total_output: i64,
    total_cache_read: i64,
    total_cache_creation: i64,
    top_models: Vec<ProjectModelEntry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectModelEntry {
    model: String,
    count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TokenRatePoint {
    minute: String,
    input_tokens: i64,
    output_tokens: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FiltersResponse {
    projects: Vec<String>,
    agents: Vec<String>,
}

// ── Query Param Structs ───────────────────────────────────────────────

#[derive(Deserialize)]
struct TimeSeriesParams {
    from: Option<String>,
    to: Option<String>,
    agent: Option<String>,
    granularity: Option<String>,
}

// ── Helper Functions ──────────────────────────────────────────────────

fn auto_granularity(from: &str, to: &str) -> &'static str {
    let from_date = chrono::NaiveDate::parse_from_str(from, "%Y-%m-%d").unwrap_or_default();
    let to_date = chrono::NaiveDate::parse_from_str(to, "%Y-%m-%d").unwrap_or_default();
    let days = (to_date - from_date).num_days();
    if days < 14 {
        "daily"
    } else if days <= 90 {
        "weekly"
    } else {
        "monthly"
    }
}

fn compute_trend(current: f64, prior: f64) -> Option<f64> {
    if prior == 0.0 {
        None
    } else {
        Some(((current - prior) / prior) * 100.0)
    }
}

/// Build WHERE clause fragments and params for date range + optional agent filter.
/// Returns (where_clause, params) where params are boxed ToSql values.
fn build_date_filter(
    from: &str,
    to: &str,
    agent: &Option<String>,
    table_prefix: &str,
) -> (String, Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql + Send>>) {
    let to_inclusive = format!("{}T23:59:59Z", to);
    let mut conditions = vec![
        format!("{}.created_at >= ?", table_prefix),
        format!("{}.created_at <= ?", table_prefix),
    ];
    let mut params: Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql + Send>> = vec![
        Box::new(from.to_string()),
        Box::new(to_inclusive),
    ];
    if let Some(agent_val) = agent {
        conditions.push(format!("{}.agent = ?", table_prefix));
        params.push(Box::new(agent_val.clone()));
    }
    (conditions.join(" AND "), params)
}

// ── Period Stats (used by overview) ───────────────────────────────────

struct PeriodStats {
    total_input: i64,
    total_output: i64,
    total_cache_read: i64,
    total_cache_creation: i64,
    estimated_cost: f64,
    total_savings: f64,
    conversation_count: i64,
    active_days: i64,
}

async fn compute_period_stats(
    db: &AppState,
    from: &str,
    to: &str,
    agent: &Option<String>,
) -> Result<PeriodStats, AppError> {
    let from = from.to_string();
    let to = to.to_string();
    let agent = agent.clone();

    let stats = db
        .call(move |conn| {
            let to_inclusive = format!("{}T23:59:59Z", to);

            // Build the agent condition
            let agent_condition = if agent.is_some() {
                " AND conversations.agent = ?"
            } else {
                ""
            };

            // 1. Token totals
            let token_sql = format!(
                "SELECT
                    COALESCE(SUM(token_usage.input_tokens), 0),
                    COALESCE(SUM(token_usage.output_tokens), 0),
                    COALESCE(SUM(token_usage.cache_read_tokens), 0),
                    COALESCE(SUM(token_usage.cache_creation_tokens), 0)
                FROM token_usage
                INNER JOIN conversations ON token_usage.conversation_id = conversations.id
                WHERE conversations.created_at >= ?1
                    AND conversations.created_at <= ?2{}",
                agent_condition
            );

            let total_input: i64;
            let total_output: i64;
            let total_cache_read: i64;
            let total_cache_creation: i64;

            if let Some(ref agent_val) = agent {
                let mut stmt = conn.prepare(&token_sql)?;
                let row = stmt.query_row(
                    params![from, to_inclusive, agent_val],
                    |row| {
                        Ok((
                            row.get::<_, i64>(0)?,
                            row.get::<_, i64>(1)?,
                            row.get::<_, i64>(2)?,
                            row.get::<_, i64>(3)?,
                        ))
                    },
                )?;
                total_input = row.0;
                total_output = row.1;
                total_cache_read = row.2;
                total_cache_creation = row.3;
            } else {
                let mut stmt = conn.prepare(&token_sql)?;
                let row = stmt.query_row(
                    params![from, to_inclusive],
                    |row| {
                        Ok((
                            row.get::<_, i64>(0)?,
                            row.get::<_, i64>(1)?,
                            row.get::<_, i64>(2)?,
                            row.get::<_, i64>(3)?,
                        ))
                    },
                )?;
                total_input = row.0;
                total_output = row.1;
                total_cache_read = row.2;
                total_cache_creation = row.3;
            }

            // 2. Conversation count (with assistant messages)
            let conv_sql = format!(
                "SELECT COUNT(*) FROM conversations
                WHERE conversations.created_at >= ?1
                    AND conversations.created_at <= ?2{}
                    AND EXISTS (SELECT 1 FROM messages WHERE messages.conversation_id = conversations.id AND messages.role = 'assistant')",
                agent_condition
            );

            let conversation_count: i64 = if let Some(ref agent_val) = agent {
                let mut stmt = conn.prepare(&conv_sql)?;
                stmt.query_row(params![from, to_inclusive, agent_val], |row| row.get(0))?
            } else {
                let mut stmt = conn.prepare(&conv_sql)?;
                stmt.query_row(params![from, to_inclusive], |row| row.get(0))?
            };

            // 3. Active days
            let days_sql = format!(
                "SELECT COUNT(DISTINCT date(conversations.created_at)) FROM conversations
                WHERE conversations.created_at >= ?1
                    AND conversations.created_at <= ?2{}
                    AND EXISTS (SELECT 1 FROM messages WHERE messages.conversation_id = conversations.id AND messages.role = 'assistant')",
                agent_condition
            );

            let active_days: i64 = if let Some(ref agent_val) = agent {
                let mut stmt = conn.prepare(&days_sql)?;
                stmt.query_row(params![from, to_inclusive, agent_val], |row| row.get(0))?
            } else {
                let mut stmt = conn.prepare(&days_sql)?;
                stmt.query_row(params![from, to_inclusive], |row| row.get(0))?
            };

            // 4. Per-model tokens for cost calculation
            let cost_sql = format!(
                "SELECT token_usage.model,
                    SUM(token_usage.input_tokens),
                    SUM(token_usage.output_tokens),
                    SUM(token_usage.cache_read_tokens),
                    SUM(token_usage.cache_creation_tokens)
                FROM token_usage
                INNER JOIN conversations ON token_usage.conversation_id = conversations.id
                WHERE conversations.created_at >= ?1
                    AND conversations.created_at <= ?2{}
                GROUP BY token_usage.conversation_id, token_usage.model",
                agent_condition
            );

            let mut estimated_cost = 0.0_f64;
            let mut total_savings = 0.0_f64;

            if let Some(ref agent_val) = agent {
                let mut stmt = conn.prepare(&cost_sql)?;
                let rows = stmt.query_map(params![from, to_inclusive, agent_val], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                    ))
                })?;
                for row_result in rows {
                    let (model, inp, outp, cr, cc) = row_result?;
                    if let Some(cost_result) = pricing::calculate_cost(&model, inp, outp, cr, cc) {
                        estimated_cost += cost_result.cost;
                        total_savings += cost_result.savings;
                    }
                }
            } else {
                let mut stmt = conn.prepare(&cost_sql)?;
                let rows = stmt.query_map(params![from, to_inclusive], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                    ))
                })?;
                for row_result in rows {
                    let (model, inp, outp, cr, cc) = row_result?;
                    if let Some(cost_result) = pricing::calculate_cost(&model, inp, outp, cr, cc) {
                        estimated_cost += cost_result.cost;
                        total_savings += cost_result.savings;
                    }
                }
            }

            Ok(PeriodStats {
                total_input,
                total_output,
                total_cache_read,
                total_cache_creation,
                estimated_cost,
                total_savings,
                conversation_count,
                active_days,
            })
        })
        .await?;

    Ok(stats)
}

// ── Handlers ──────────────────────────────────────────────────────────

async fn overview(
    State(db): State<AppState>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<OverviewStats>, AppError> {
    let (from, to) = params.resolve();

    let stats = compute_period_stats(&db, &from, &to, &params.agent).await?;

    // Compute prior period dates
    let from_date = chrono::NaiveDate::parse_from_str(&from, "%Y-%m-%d").unwrap_or_default();
    let to_date = chrono::NaiveDate::parse_from_str(&to, "%Y-%m-%d").unwrap_or_default();
    let period_days = (to_date - from_date).num_days();
    let prior_to_date = from_date - chrono::Duration::days(1);
    let prior_from_date = prior_to_date - chrono::Duration::days(period_days);
    let prior_from = prior_from_date.format("%Y-%m-%d").to_string();
    let prior_to = prior_to_date.format("%Y-%m-%d").to_string();

    let prior_stats = compute_period_stats(&db, &prior_from, &prior_to, &params.agent).await?;

    let current_total_tokens = stats.total_input + stats.total_output + stats.total_cache_read + stats.total_cache_creation;
    let prior_total_tokens = prior_stats.total_input + prior_stats.total_output + prior_stats.total_cache_read + prior_stats.total_cache_creation;

    Ok(Json(OverviewStats {
        total_tokens: current_total_tokens,
        total_input: stats.total_input,
        total_output: stats.total_output,
        total_cache_read: stats.total_cache_read,
        total_cache_creation: stats.total_cache_creation,
        estimated_cost: stats.estimated_cost,
        total_savings: stats.total_savings,
        conversation_count: stats.conversation_count,
        active_days: stats.active_days,
        trends: OverviewTrends {
            tokens_trend: compute_trend(current_total_tokens as f64, prior_total_tokens as f64),
            cost_trend: compute_trend(stats.estimated_cost, prior_stats.estimated_cost),
            conversations_trend: compute_trend(
                stats.conversation_count as f64,
                prior_stats.conversation_count as f64,
            ),
            active_days_trend: compute_trend(
                stats.active_days as f64,
                prior_stats.active_days as f64,
            ),
        },
    }))
}

async fn timeseries(
    State(db): State<AppState>,
    Query(params): Query<TimeSeriesParams>,
) -> Result<Json<Vec<TimeSeriesPoint>>, AppError> {
    let date_params = DateRangeParams {
        from: params.from,
        to: params.to,
        agent: params.agent.clone(),
    };
    let (from, to) = date_params.resolve();
    let granularity = params
        .granularity
        .as_deref()
        .unwrap_or_else(|| auto_granularity(&from, &to));

    let date_format = match granularity {
        "daily" => "%Y-%m-%d",
        "weekly" => "%Y-W%W",
        _ => "%Y-%m",
    };

    let from_c = from.clone();
    let to_c = to.clone();
    let agent = params.agent.clone();
    let date_format = date_format.to_string();

    let points = db
        .call(move |conn| {
            let to_inclusive = format!("{}T23:59:59Z", to_c);
            let agent_condition = if agent.is_some() {
                " AND conversations.agent = ?"
            } else {
                ""
            };

            let sql = format!(
                "SELECT
                    strftime('{}', conversations.created_at) as period,
                    token_usage.model,
                    SUM(token_usage.input_tokens) as input_tokens,
                    SUM(token_usage.output_tokens) as output_tokens,
                    SUM(token_usage.cache_read_tokens) as cache_read_tokens,
                    SUM(token_usage.cache_creation_tokens) as cache_creation_tokens,
                    COUNT(DISTINCT token_usage.conversation_id) as conversation_count
                FROM token_usage
                INNER JOIN conversations ON token_usage.conversation_id = conversations.id
                WHERE conversations.created_at >= ?1
                    AND conversations.created_at <= ?2{}
                GROUP BY period, token_usage.model
                ORDER BY period",
                date_format, agent_condition
            );

            let mut stmt = conn.prepare(&sql)?;

            let rows: Vec<(String, String, i64, i64, i64, i64, i64)> = if let Some(ref agent_val) = agent {
                let mapped = stmt.query_map(params![from_c, to_inclusive, agent_val], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                    ))
                })?;
                mapped.collect::<Result<Vec<_>, _>>()?
            } else {
                let mapped = stmt.query_map(params![from_c, to_inclusive], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, i64>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                        row.get::<_, i64>(5)?,
                        row.get::<_, i64>(6)?,
                    ))
                })?;
                mapped.collect::<Result<Vec<_>, _>>()?
            };

            // Aggregate per-model rows into per-period rows
            let mut period_map: HashMap<String, TimeSeriesPoint> = HashMap::new();

            for (period, model, inp, outp, cr, cc, conv_count) in rows {
                let cost_result = pricing::calculate_cost(&model, inp, outp, cr, cc);
                let cost = cost_result.map(|c| c.cost).unwrap_or(0.0);

                let entry = period_map.entry(period.clone()).or_insert(TimeSeriesPoint {
                    period,
                    input_tokens: 0,
                    output_tokens: 0,
                    cache_read_tokens: 0,
                    cache_creation_tokens: 0,
                    cost: 0.0,
                    conversation_count: 0,
                });
                entry.input_tokens += inp;
                entry.output_tokens += outp;
                entry.cache_read_tokens += cr;
                entry.cache_creation_tokens += cc;
                entry.cost += cost;
                entry.conversation_count += conv_count;
            }

            let mut result: Vec<TimeSeriesPoint> = period_map.into_values().collect();
            result.sort_by(|a, b| a.period.cmp(&b.period));
            Ok(result)
        })
        .await?;

    Ok(Json(points))
}

async fn model_distribution(
    State(db): State<AppState>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<Vec<ModelDistributionEntry>>, AppError> {
    let (from, to) = params.resolve();
    let agent = params.agent.clone();

    let rows = db
        .call(move |conn| {
            let to_inclusive = format!("{}T23:59:59Z", to);
            let agent_condition = if agent.is_some() {
                " AND conversations.agent = ?"
            } else {
                ""
            };

            let sql = format!(
                "SELECT
                    token_usage.model,
                    COUNT(DISTINCT token_usage.conversation_id) as count,
                    COALESCE(SUM(token_usage.input_tokens) + SUM(token_usage.output_tokens) + SUM(token_usage.cache_read_tokens) + SUM(token_usage.cache_creation_tokens), 0) as total_tokens
                FROM token_usage
                INNER JOIN conversations ON token_usage.conversation_id = conversations.id
                WHERE conversations.created_at >= ?1
                    AND conversations.created_at <= ?2{}
                GROUP BY token_usage.model
                ORDER BY total_tokens DESC",
                agent_condition
            );

            let mut stmt = conn.prepare(&sql)?;

            let rows: Vec<ModelDistributionEntry> = if let Some(ref agent_val) = agent {
                let mapped = stmt.query_map(params![from, to_inclusive, agent_val], |row| {
                    Ok(ModelDistributionEntry {
                        model: row.get(0)?,
                        count: row.get(1)?,
                        total_tokens: row.get(2)?,
                    })
                })?;
                mapped.collect::<Result<Vec<_>, _>>()?
            } else {
                let mapped = stmt.query_map(params![from, to_inclusive], |row| {
                    Ok(ModelDistributionEntry {
                        model: row.get(0)?,
                        count: row.get(1)?,
                        total_tokens: row.get(2)?,
                    })
                })?;
                mapped.collect::<Result<Vec<_>, _>>()?
            };

            Ok(rows)
        })
        .await?;

    Ok(Json(rows))
}

async fn filters(
    State(db): State<AppState>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<FiltersResponse>, AppError> {
    let (from, to) = params.resolve();

    let response = db
        .call(move |conn| {
            let to_inclusive = format!("{}T23:59:59Z", to);

            // Distinct projects (non-null)
            let mut stmt = conn.prepare(
                "SELECT DISTINCT project FROM conversations
                WHERE created_at >= ?1 AND created_at <= ?2 AND project IS NOT NULL
                ORDER BY project",
            )?;
            let projects: Vec<String> = stmt
                .query_map(params![from, to_inclusive], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?;

            // Distinct agents
            let mut stmt2 = conn.prepare(
                "SELECT DISTINCT agent FROM conversations
                WHERE created_at >= ?1 AND created_at <= ?2
                ORDER BY agent",
            )?;
            let agents: Vec<String> = stmt2
                .query_map(params![&from, &to_inclusive], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(FiltersResponse { projects, agents })
        })
        .await?;

    Ok(Json(response))
}

// ── Stub Handlers (Task 2 will fill in) ───────────────────────────────

async fn tool_stats(
    State(_db): State<AppState>,
    Query(_params): Query<DateRangeParams>,
) -> Result<Json<Vec<ToolStatsRow>>, AppError> {
    Ok(Json(vec![]))
}

async fn heatmap(
    State(_db): State<AppState>,
    Query(_params): Query<DateRangeParams>,
) -> Result<Json<Vec<HeatmapDay>>, AppError> {
    Ok(Json(vec![]))
}

async fn project_stats(
    State(_db): State<AppState>,
    Query(_params): Query<DateRangeParams>,
) -> Result<Json<Vec<ProjectStatsRow>>, AppError> {
    Ok(Json(vec![]))
}

async fn token_rate(
    State(_db): State<AppState>,
) -> Result<Json<Vec<TokenRatePoint>>, AppError> {
    Ok(Json(vec![]))
}
