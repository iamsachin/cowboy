use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio_rusqlite::rusqlite::params;
use tokio_rusqlite::rusqlite::OptionalExtension;

use crate::error::AppError;
use crate::extractors::{DateRangeParams, PaginationParams};
use crate::server::AppState;

// ── Route Registration ──────────────────────────────────────────────

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/api/plans/stats", get(plan_stats))
        .route("/api/plans/timeseries", get(plan_timeseries))
        .route(
            "/api/plans/by-conversation/{conversationId}",
            get(plans_by_conversation),
        )
        .route("/api/plans/{id}", get(plan_detail))
        .route("/api/plans", get(plan_list))
}

// ── Query Params ────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct PlanListParams {
    pub from: Option<String>,
    pub to: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    pub sort: Option<String>,
    pub order: Option<String>,
    pub agent: Option<String>,
    pub project: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
pub struct PlanTimeseriesParams {
    pub from: Option<String>,
    pub to: Option<String>,
    pub granularity: Option<String>,
    pub agent: Option<String>,
}

// ── Response Structs ────────────────────────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanRow {
    pub id: String,
    pub conversation_id: String,
    pub title: String,
    pub total_steps: i64,
    pub completed_steps: i64,
    pub status: String,
    pub created_at: String,
    pub agent: String,
    pub project: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlanStepRow {
    pub id: String,
    pub plan_id: String,
    pub step_number: i64,
    pub content: String,
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanListResponse {
    pub rows: Vec<PlanRow>,
    pub total: i64,
    pub page: u32,
    pub limit: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanDetailResponse {
    pub plan: PlanRow,
    pub steps: Vec<PlanStepRow>,
    pub conversation_title: Option<String>,
    pub source_message_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanStatsResponse {
    pub total_plans: i64,
    pub total_steps: i64,
    pub completion_rate: f64,
    pub avg_steps_per_plan: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanTimeSeriesPoint {
    pub period: String,
    pub plan_count: i64,
    pub completion_rate: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationPlanEntry {
    pub plan: PlanRow,
    pub steps: Vec<PlanStepRow>,
}

// ── Helpers ─────────────────────────────────────────────────────────

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

fn sort_column(sort: &str) -> &'static str {
    match sort {
        "title" => "plans.title",
        "steps" | "totalSteps" => "plans.total_steps",
        "completedSteps" => "plans.completed_steps",
        "status" => "plans.status",
        "agent" => "conversations.agent",
        "project" => "conversations.project",
        _ => "plans.created_at", // default: "date"
    }
}

// ── Handlers ────────────────────────────────────────────────────────

/// GET /api/plans
async fn plan_list(
    State(db): State<AppState>,
    Query(params): Query<PlanListParams>,
) -> Result<Json<PlanListResponse>, AppError> {
    let date_range = DateRangeParams {
        from: params.from,
        to: params.to,
        agent: params.agent.clone(),
    };
    let pagination = PaginationParams {
        page: params.page,
        limit: params.limit,
        sort: params.sort,
        order: params.order,
    };

    let (from, to) = date_range.resolve();
    let (page, limit, sort, order) = pagination.resolve();
    let offset = ((page - 1) * limit) as i64;
    let limit_i64 = limit as i64;
    let to_with_time = format!("{}T23:59:59Z", to);

    let agent = params.agent;
    let project = params.project;
    let status = params.status;
    let sort_col = sort_column(&sort);
    let order_dir = if order == "asc" { "ASC" } else { "DESC" };

    let result = db
        .call(move |conn| {
            // Build dynamic WHERE
            let mut conditions = vec![
                "conversations.created_at >= ?1".to_string(),
                "conversations.created_at <= ?2".to_string(),
            ];
            let mut param_values: Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql>> = vec![
                Box::new(from.clone()),
                Box::new(to_with_time.clone()),
            ];
            let mut param_idx = 3;

            if let Some(ref agent_val) = agent {
                conditions.push(format!("conversations.agent = ?{}", param_idx));
                param_values.push(Box::new(agent_val.clone()));
                param_idx += 1;
            }
            if let Some(ref project_val) = project {
                conditions.push(format!("conversations.project = ?{}", param_idx));
                param_values.push(Box::new(project_val.clone()));
                param_idx += 1;
            }
            if let Some(ref status_val) = status {
                conditions.push(format!("plans.status = ?{}", param_idx));
                param_values.push(Box::new(status_val.clone()));
                // param_idx not needed further
            }

            let where_clause = conditions.join(" AND ");

            // Main query
            let sql = format!(
                "SELECT plans.id, plans.conversation_id, plans.title, plans.total_steps,
                        plans.completed_steps, plans.status, plans.created_at,
                        conversations.agent, conversations.project
                 FROM plans
                 INNER JOIN conversations ON plans.conversation_id = conversations.id
                 WHERE {}
                 ORDER BY {} {}
                 LIMIT {} OFFSET {}",
                where_clause, sort_col, order_dir, limit_i64, offset
            );

            let params_refs: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                param_values.iter().map(|b| b.as_ref()).collect();

            let mut stmt = conn.prepare(&sql)?;
            let rows: Vec<PlanRow> = stmt
                .query_map(params_refs.as_slice(), |row| {
                    Ok(PlanRow {
                        id: row.get(0)?,
                        conversation_id: row.get(1)?,
                        title: row.get(2)?,
                        total_steps: row.get(3)?,
                        completed_steps: row.get(4)?,
                        status: row.get(5)?,
                        created_at: row.get(6)?,
                        agent: row.get(7)?,
                        project: row.get(8)?,
                    })
                })?
                .collect::<Result<_, _>>()?;

            // Total count
            let count_sql = format!(
                "SELECT count(*) FROM plans
                 INNER JOIN conversations ON plans.conversation_id = conversations.id
                 WHERE {}",
                where_clause
            );

            // Rebuild params for count query (same params, no limit/offset)
            let mut count_params: Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql>> = vec![
                Box::new(from),
                Box::new(to_with_time),
            ];
            if let Some(ref agent_val) = agent {
                count_params.push(Box::new(agent_val.clone()));
            }
            if let Some(ref project_val) = project {
                count_params.push(Box::new(project_val.clone()));
            }
            if let Some(ref status_val) = status {
                count_params.push(Box::new(status_val.clone()));
            }

            let count_refs: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                count_params.iter().map(|b| b.as_ref()).collect();
            let total: i64 = conn.query_row(&count_sql, count_refs.as_slice(), |row| row.get(0))?;

            Ok((rows, total))
        })
        .await
        .map_err(AppError::from)?;

    let (rows, total) = result;
    Ok(Json(PlanListResponse {
        rows,
        total,
        page,
        limit,
    }))
}

/// GET /api/plans/{id}
async fn plan_detail(
    State(db): State<AppState>,
    Path(plan_id): Path<String>,
) -> Result<Json<PlanDetailResponse>, AppError> {
    let result = db
        .call(move |conn| {
            // Fetch plan with conversation metadata
            let plan_opt: Option<(PlanRow, Option<String>, String)> = conn
                .query_row(
                    "SELECT plans.id, plans.conversation_id, plans.title, plans.total_steps,
                            plans.completed_steps, plans.status, plans.created_at,
                            conversations.agent, conversations.project,
                            conversations.title, plans.source_message_id
                     FROM plans
                     INNER JOIN conversations ON plans.conversation_id = conversations.id
                     WHERE plans.id = ?1",
                    params![plan_id],
                    |row| {
                        Ok((
                            PlanRow {
                                id: row.get(0)?,
                                conversation_id: row.get(1)?,
                                title: row.get(2)?,
                                total_steps: row.get(3)?,
                                completed_steps: row.get(4)?,
                                status: row.get(5)?,
                                created_at: row.get(6)?,
                                agent: row.get(7)?,
                                project: row.get(8)?,
                            },
                            row.get::<_, Option<String>>(9)?,
                            row.get::<_, String>(10)?,
                        ))
                    },
                )
                .optional()?;

            let (plan, conversation_title, source_message_id) = match plan_opt {
                Some(p) => p,
                None => {
                    return Ok(None);
                }
            };

            // Fetch steps
            let mut stmt = conn.prepare(
                "SELECT id, plan_id, step_number, content, status
                 FROM plan_steps
                 WHERE plan_id = ?1
                 ORDER BY step_number",
            )?;
            let steps: Vec<PlanStepRow> = stmt
                .query_map(params![plan.id], |row| {
                    Ok(PlanStepRow {
                        id: row.get(0)?,
                        plan_id: row.get(1)?,
                        step_number: row.get(2)?,
                        content: row.get(3)?,
                        status: row.get(4)?,
                    })
                })?
                .collect::<Result<_, _>>()?;

            Ok(Some(PlanDetailResponse {
                plan,
                steps,
                conversation_title,
                source_message_id,
            }))
        })
        .await
        .map_err(AppError::from)?;

    match result {
        Some(detail) => Ok(Json(detail)),
        None => Err(AppError::NotFound("Plan not found".to_string())),
    }
}

/// GET /api/plans/stats
async fn plan_stats(
    State(db): State<AppState>,
    Query(params): Query<DateRangeParams>,
) -> Result<Json<PlanStatsResponse>, AppError> {
    let (from, to) = params.resolve();
    let to_with_time = format!("{}T23:59:59Z", to);
    let agent = params.agent;

    let result = db
        .call(move |conn| {
            let (sql, param_values): (String, Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql>>) =
                if let Some(ref agent_val) = agent {
                    (
                        "SELECT count(*), COALESCE(sum(plans.total_steps), 0),
                                COALESCE(sum(plans.completed_steps), 0),
                                COALESCE(avg(plans.total_steps), 0)
                         FROM plans
                         INNER JOIN conversations ON plans.conversation_id = conversations.id
                         WHERE conversations.created_at >= ?1
                           AND conversations.created_at <= ?2
                           AND conversations.agent = ?3"
                            .to_string(),
                        vec![
                            Box::new(from),
                            Box::new(to_with_time),
                            Box::new(agent_val.clone()),
                        ],
                    )
                } else {
                    (
                        "SELECT count(*), COALESCE(sum(plans.total_steps), 0),
                                COALESCE(sum(plans.completed_steps), 0),
                                COALESCE(avg(plans.total_steps), 0)
                         FROM plans
                         INNER JOIN conversations ON plans.conversation_id = conversations.id
                         WHERE conversations.created_at >= ?1
                           AND conversations.created_at <= ?2"
                            .to_string(),
                        vec![Box::new(from), Box::new(to_with_time)],
                    )
                };

            let params_refs: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                param_values.iter().map(|b| b.as_ref()).collect();

            let (total_plans, total_steps, completed_steps, avg_steps): (i64, i64, i64, f64) =
                conn.query_row(&sql, params_refs.as_slice(), |row| {
                    Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
                })?;

            let completion_rate = if total_steps > 0 {
                (completed_steps as f64 / total_steps as f64) * 100.0
            } else {
                0.0
            };

            Ok(PlanStatsResponse {
                total_plans,
                total_steps,
                completion_rate: (completion_rate * 10.0).round() / 10.0,
                avg_steps_per_plan: (avg_steps * 10.0).round() / 10.0,
            })
        })
        .await
        .map_err(AppError::from)?;

    Ok(Json(result))
}

/// GET /api/plans/timeseries
async fn plan_timeseries(
    State(db): State<AppState>,
    Query(params): Query<PlanTimeseriesParams>,
) -> Result<Json<Vec<PlanTimeSeriesPoint>>, AppError> {
    let date_range = DateRangeParams {
        from: params.from,
        to: params.to,
        agent: params.agent.clone(),
    };
    let (from, to) = date_range.resolve();
    let granularity = params
        .granularity
        .unwrap_or_else(|| auto_granularity(&from, &to).to_string());
    let to_with_time = format!("{}T23:59:59Z", to);
    let agent = params.agent;

    let date_format = match granularity.as_str() {
        "daily" => "%Y-%m-%d",
        "weekly" => "%Y-W%W",
        _ => "%Y-%m",
    };

    let result = db
        .call(move |conn| {
            let (sql, param_values): (String, Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql>>) =
                if let Some(ref agent_val) = agent {
                    (
                        format!(
                            "SELECT strftime('{}', plans.created_at) as period,
                                    count(*) as plan_count,
                                    COALESCE(sum(plans.total_steps), 0) as total_steps,
                                    COALESCE(sum(plans.completed_steps), 0) as completed_steps
                             FROM plans
                             INNER JOIN conversations ON plans.conversation_id = conversations.id
                             WHERE conversations.created_at >= ?1
                               AND conversations.created_at <= ?2
                               AND conversations.agent = ?3
                             GROUP BY period
                             ORDER BY period",
                            date_format
                        ),
                        vec![
                            Box::new(from),
                            Box::new(to_with_time),
                            Box::new(agent_val.clone()),
                        ],
                    )
                } else {
                    (
                        format!(
                            "SELECT strftime('{}', plans.created_at) as period,
                                    count(*) as plan_count,
                                    COALESCE(sum(plans.total_steps), 0) as total_steps,
                                    COALESCE(sum(plans.completed_steps), 0) as completed_steps
                             FROM plans
                             INNER JOIN conversations ON plans.conversation_id = conversations.id
                             WHERE conversations.created_at >= ?1
                               AND conversations.created_at <= ?2
                             GROUP BY period
                             ORDER BY period",
                            date_format
                        ),
                        vec![Box::new(from), Box::new(to_with_time)],
                    )
                };

            let params_refs: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                param_values.iter().map(|b| b.as_ref()).collect();

            let mut stmt = conn.prepare(&sql)?;
            let rows: Vec<PlanTimeSeriesPoint> = stmt
                .query_map(params_refs.as_slice(), |row| {
                    let period: String = row.get(0)?;
                    let plan_count: i64 = row.get(1)?;
                    let total_steps: i64 = row.get(2)?;
                    let completed_steps: i64 = row.get(3)?;

                    let rate = if total_steps > 0 {
                        (completed_steps as f64 / total_steps as f64) * 100.0
                    } else {
                        0.0
                    };

                    Ok(PlanTimeSeriesPoint {
                        period,
                        plan_count,
                        completion_rate: (rate * 10.0).round() / 10.0,
                    })
                })?
                .collect::<Result<_, _>>()?;

            Ok(rows)
        })
        .await
        .map_err(AppError::from)?;

    Ok(Json(result))
}

/// GET /api/plans/by-conversation/{conversationId}
async fn plans_by_conversation(
    State(db): State<AppState>,
    Path(conversation_id): Path<String>,
) -> Result<Json<Vec<ConversationPlanEntry>>, AppError> {
    let result = db
        .call(move |conn| {
            // Fetch all plans for this conversation
            let mut plan_stmt = conn.prepare(
                "SELECT plans.id, plans.conversation_id, plans.title, plans.total_steps,
                        plans.completed_steps, plans.status, plans.created_at,
                        conversations.agent, conversations.project
                 FROM plans
                 INNER JOIN conversations ON plans.conversation_id = conversations.id
                 WHERE plans.conversation_id = ?1
                 ORDER BY plans.created_at",
            )?;

            let plan_rows: Vec<PlanRow> = plan_stmt
                .query_map(params![conversation_id], |row| {
                    Ok(PlanRow {
                        id: row.get(0)?,
                        conversation_id: row.get(1)?,
                        title: row.get(2)?,
                        total_steps: row.get(3)?,
                        completed_steps: row.get(4)?,
                        status: row.get(5)?,
                        created_at: row.get(6)?,
                        agent: row.get(7)?,
                        project: row.get(8)?,
                    })
                })?
                .collect::<Result<_, _>>()?;

            if plan_rows.is_empty() {
                return Ok(vec![]);
            }

            // Fetch all steps for all plans in one query to avoid N+1
            let plan_ids: Vec<String> = plan_rows.iter().map(|p| p.id.clone()).collect();
            let placeholders: Vec<String> =
                (1..=plan_ids.len()).map(|i| format!("?{}", i)).collect();
            let in_clause = placeholders.join(", ");

            let step_sql = format!(
                "SELECT id, plan_id, step_number, content, status
                 FROM plan_steps
                 WHERE plan_id IN ({})
                 ORDER BY step_number",
                in_clause
            );

            let step_params: Vec<Box<dyn tokio_rusqlite::rusqlite::types::ToSql>> = plan_ids
                .iter()
                .map(|id| Box::new(id.clone()) as Box<dyn tokio_rusqlite::rusqlite::types::ToSql>)
                .collect();
            let step_refs: Vec<&dyn tokio_rusqlite::rusqlite::types::ToSql> =
                step_params.iter().map(|b| b.as_ref()).collect();

            let mut step_stmt = conn.prepare(&step_sql)?;
            let all_steps: Vec<PlanStepRow> = step_stmt
                .query_map(step_refs.as_slice(), |row| {
                    Ok(PlanStepRow {
                        id: row.get(0)?,
                        plan_id: row.get(1)?,
                        step_number: row.get(2)?,
                        content: row.get(3)?,
                        status: row.get(4)?,
                    })
                })?
                .collect::<Result<_, _>>()?;

            // Group steps by plan_id
            let mut steps_by_plan: HashMap<String, Vec<PlanStepRow>> = HashMap::new();
            for step in all_steps {
                steps_by_plan
                    .entry(step.plan_id.clone())
                    .or_default()
                    .push(step);
            }

            // Assemble response
            let entries: Vec<ConversationPlanEntry> = plan_rows
                .into_iter()
                .map(|plan| {
                    let steps = steps_by_plan.remove(&plan.id).unwrap_or_default();
                    ConversationPlanEntry { plan, steps }
                })
                .collect();

            Ok(entries)
        })
        .await
        .map_err(AppError::from)?;

    Ok(Json(result))
}
