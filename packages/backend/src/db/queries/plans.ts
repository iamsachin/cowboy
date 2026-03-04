import { db } from '../index.js';
import { plans, planSteps, conversations } from '../schema.js';
import { sql, and, gte, lte, eq } from 'drizzle-orm';
import type { PlanRow, PlanListResponse, PlanDetailResponse, PlanStepRow, PlanStatsResponse, PlanTimeSeriesPoint } from '@cowboy/shared';
import type { Granularity } from '@cowboy/shared';

/**
 * Get paginated list of plans with optional filters.
 * Joins with conversations to get agent/project fields.
 */
export function getPlanList(
  from: string,
  to: string,
  page: number = 1,
  limit: number = 20,
  sort: string = 'date',
  order: string = 'desc',
  agent?: string,
  project?: string,
  status?: string,
): PlanListResponse {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));
  if (project) conditions.push(eq(conversations.project, project));
  if (status) conditions.push(eq(plans.status, status));
  const dateFilter = and(...conditions);

  const offset = (page - 1) * limit;

  // Sort column mapping
  const sortColumn = sort === 'title' ? sql`${plans.title}`
    : sort === 'totalSteps' ? sql`${plans.totalSteps}`
    : sort === 'completedSteps' ? sql`${plans.completedSteps}`
    : sort === 'status' ? sql`${plans.status}`
    : sql`${plans.createdAt}`;

  const orderDir = order === 'asc' ? sql`ASC` : sql`DESC`;

  const rows = db
    .select({
      id: plans.id,
      conversationId: plans.conversationId,
      title: plans.title,
      totalSteps: plans.totalSteps,
      completedSteps: plans.completedSteps,
      status: plans.status,
      createdAt: plans.createdAt,
      agent: conversations.agent,
      project: conversations.project,
    })
    .from(plans)
    .innerJoin(conversations, sql`${plans.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .orderBy(sql`${sortColumn} ${orderDir}`)
    .limit(limit)
    .offset(offset)
    .all();

  // Total count with same filters
  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(plans)
    .innerJoin(conversations, sql`${plans.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .get();

  const planRows: PlanRow[] = rows.map(row => ({
    id: row.id,
    conversationId: row.conversationId,
    title: row.title,
    totalSteps: row.totalSteps,
    completedSteps: row.completedSteps,
    status: row.status,
    createdAt: row.createdAt,
    agent: row.agent,
    project: row.project,
  }));

  return {
    rows: planRows,
    total: Number(totalResult?.count ?? 0),
    page,
    limit,
  };
}

/**
 * Get plan detail with all steps and conversation metadata.
 * Returns null if plan not found.
 */
export function getPlanDetail(planId: string): PlanDetailResponse | null {
  const planRow = db
    .select({
      id: plans.id,
      conversationId: plans.conversationId,
      sourceMessageId: plans.sourceMessageId,
      title: plans.title,
      totalSteps: plans.totalSteps,
      completedSteps: plans.completedSteps,
      status: plans.status,
      createdAt: plans.createdAt,
      agent: conversations.agent,
      project: conversations.project,
      conversationTitle: conversations.title,
    })
    .from(plans)
    .innerJoin(conversations, sql`${plans.conversationId} = ${conversations.id}`)
    .where(eq(plans.id, planId))
    .get();

  if (!planRow) return null;

  const steps = db
    .select({
      id: planSteps.id,
      planId: planSteps.planId,
      stepNumber: planSteps.stepNumber,
      content: planSteps.content,
      status: planSteps.status,
    })
    .from(planSteps)
    .where(eq(planSteps.planId, planId))
    .orderBy(planSteps.stepNumber)
    .all();

  const stepRows: PlanStepRow[] = steps.map(s => ({
    id: s.id,
    planId: s.planId,
    stepNumber: s.stepNumber,
    content: s.content,
    status: s.status,
  }));

  return {
    plan: {
      id: planRow.id,
      conversationId: planRow.conversationId,
      title: planRow.title,
      totalSteps: planRow.totalSteps,
      completedSteps: planRow.completedSteps,
      status: planRow.status,
      createdAt: planRow.createdAt,
      agent: planRow.agent,
      project: planRow.project,
    },
    steps: stepRows,
    conversationTitle: planRow.conversationTitle,
    sourceMessageId: planRow.sourceMessageId,
  };
}

/**
 * Get aggregate plan statistics: total plans, total steps, completion rate, avg steps per plan.
 * Handles zero-division: if totalSteps=0, completionRate=0.
 */
export function getPlanStats(from: string, to: string, agent?: string): PlanStatsResponse {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));
  const dateFilter = and(...conditions);

  const agg = db
    .select({
      totalPlans: sql<number>`count(*)`,
      totalSteps: sql<number>`coalesce(sum(${plans.totalSteps}), 0)`,
      completedSteps: sql<number>`coalesce(sum(${plans.completedSteps}), 0)`,
      avgSteps: sql<number>`coalesce(avg(${plans.totalSteps}), 0)`,
    })
    .from(plans)
    .innerJoin(conversations, sql`${plans.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .get();

  const totalSteps = Number(agg?.totalSteps ?? 0);
  const completedSteps = Number(agg?.completedSteps ?? 0);

  const completionRate = totalSteps > 0
    ? (completedSteps / totalSteps) * 100
    : 0;

  return {
    totalPlans: Number(agg?.totalPlans ?? 0),
    totalSteps,
    completionRate: Math.round(completionRate * 10) / 10,
    avgStepsPerPlan: Math.round(Number(agg?.avgSteps ?? 0) * 10) / 10,
  };
}

/**
 * Get plan time series data grouped by period.
 * Returns per-period plan count and completion rate.
 */
export function getPlanTimeSeries(
  from: string,
  to: string,
  granularity: Granularity,
  agent?: string,
): PlanTimeSeriesPoint[] {
  const dateFormat = granularity === 'daily'
    ? '%Y-%m-%d'
    : granularity === 'weekly'
    ? '%Y-W%W'
    : '%Y-%m';

  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));
  const dateFilter = and(...conditions);

  const rows = db
    .select({
      period: sql<string>`strftime('${sql.raw(dateFormat)}', ${plans.createdAt})`.as('period'),
      planCount: sql<number>`count(*)`,
      totalSteps: sql<number>`coalesce(sum(${plans.totalSteps}), 0)`,
      completedSteps: sql<number>`coalesce(sum(${plans.completedSteps}), 0)`,
    })
    .from(plans)
    .innerJoin(conversations, sql`${plans.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .groupBy(sql`period`)
    .orderBy(sql`period`)
    .all();

  return rows.map(row => {
    const total = Number(row.totalSteps);
    const completed = Number(row.completedSteps);
    const rate = total > 0 ? (completed / total) * 100 : 0;

    return {
      period: row.period,
      planCount: Number(row.planCount),
      completionRate: Math.round(rate * 10) / 10,
    };
  });
}

/**
 * Get all plans for a given conversation with their steps.
 * Used for inline plan display in conversation detail page.
 */
export function getPlansByConversation(
  conversationId: string,
): Array<{ plan: PlanRow; steps: PlanStepRow[] }> {
  const planRows = db
    .select({
      id: plans.id,
      conversationId: plans.conversationId,
      title: plans.title,
      totalSteps: plans.totalSteps,
      completedSteps: plans.completedSteps,
      status: plans.status,
      createdAt: plans.createdAt,
      agent: conversations.agent,
      project: conversations.project,
    })
    .from(plans)
    .innerJoin(conversations, sql`${plans.conversationId} = ${conversations.id}`)
    .where(eq(plans.conversationId, conversationId))
    .orderBy(plans.createdAt)
    .all();

  return planRows.map(planRow => {
    const steps = db
      .select({
        id: planSteps.id,
        planId: planSteps.planId,
        stepNumber: planSteps.stepNumber,
        content: planSteps.content,
        status: planSteps.status,
      })
      .from(planSteps)
      .where(eq(planSteps.planId, planRow.id))
      .orderBy(planSteps.stepNumber)
      .all();

    return {
      plan: {
        id: planRow.id,
        conversationId: planRow.conversationId,
        title: planRow.title,
        totalSteps: planRow.totalSteps,
        completedSteps: planRow.completedSteps,
        status: planRow.status,
        createdAt: planRow.createdAt,
        agent: planRow.agent,
        project: planRow.project,
      },
      steps: steps.map(s => ({
        id: s.id,
        planId: s.planId,
        stepNumber: s.stepNumber,
        content: s.content,
        status: s.status,
      })),
    };
  });
}
