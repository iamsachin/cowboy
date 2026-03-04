import { db } from '../index.js';
import { conversations, messages, toolCalls, tokenUsage } from '../schema.js';
import { sql, and, gte, lte, eq, like, or } from 'drizzle-orm';
import { calculateCost } from '@cowboy/shared';
import type { OverviewStats, TimeSeriesPoint, ConversationRow, ConversationListResponse, ConversationDetailResponse, ToolStatsRow, HeatmapDay, ProjectStatsRow, ProjectModelEntry } from '@cowboy/shared';
import type { Granularity } from '@cowboy/shared';

/**
 * Get overview stats for KPI cards: token totals, cost, conversation count, active days, trends.
 * Optional agent parameter filters results to a specific agent (e.g., 'claude-code' or 'cursor').
 */
export function getOverviewStats(from: string, to: string, agent?: string): OverviewStats {
  const stats = computePeriodStats(from, to, agent);

  // Compute prior period for trend calculation
  // Prior period ends the day before current 'from' to avoid overlap
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const periodMs = toDate.getTime() - fromDate.getTime();
  const priorToDate = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const priorFromDate = new Date(priorToDate.getTime() - periodMs);
  const priorFrom = priorFromDate.toISOString().slice(0, 10);
  const priorTo = priorToDate.toISOString().slice(0, 10);

  const priorStats = computePeriodStats(priorFrom, priorTo, agent);

  return {
    totalTokens: stats.totalInput + stats.totalOutput + stats.totalCacheRead + stats.totalCacheCreation,
    totalInput: stats.totalInput,
    totalOutput: stats.totalOutput,
    totalCacheRead: stats.totalCacheRead,
    totalCacheCreation: stats.totalCacheCreation,
    estimatedCost: stats.estimatedCost,
    totalSavings: stats.totalSavings,
    conversationCount: stats.conversationCount,
    activeDays: stats.activeDays,
    trends: {
      tokensTrend: computeTrend(
        stats.totalInput + stats.totalOutput + stats.totalCacheRead + stats.totalCacheCreation,
        priorStats.totalInput + priorStats.totalOutput + priorStats.totalCacheRead + priorStats.totalCacheCreation
      ),
      costTrend: computeTrend(stats.estimatedCost, priorStats.estimatedCost),
      conversationsTrend: computeTrend(stats.conversationCount, priorStats.conversationCount),
      activeDaysTrend: computeTrend(stats.activeDays, priorStats.activeDays),
    },
  };
}

function computeTrend(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

interface PeriodStats {
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCacheCreation: number;
  estimatedCost: number;
  totalSavings: number;
  conversationCount: number;
  activeDays: number;
}

function computePeriodStats(from: string, to: string, agent?: string): PeriodStats {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));
  const dateFilter = and(...conditions);

  // Token totals
  const tokenTotals = db
    .select({
      totalInput: sql<number>`coalesce(sum(${tokenUsage.inputTokens}), 0)`,
      totalOutput: sql<number>`coalesce(sum(${tokenUsage.outputTokens}), 0)`,
      totalCacheRead: sql<number>`coalesce(sum(${tokenUsage.cacheReadTokens}), 0)`,
      totalCacheCreation: sql<number>`coalesce(sum(${tokenUsage.cacheCreationTokens}), 0)`,
    })
    .from(tokenUsage)
    .innerJoin(conversations, sql`${tokenUsage.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .get();

  // Conversation count
  const convCount = db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(dateFilter)
    .get();

  // Active days
  const activeDaysResult = db
    .select({
      days: sql<number>`count(distinct date(${conversations.createdAt}))`,
    })
    .from(conversations)
    .where(dateFilter)
    .get();

  const totalInput = Number(tokenTotals?.totalInput ?? 0);
  const totalOutput = Number(tokenTotals?.totalOutput ?? 0);
  const totalCacheRead = Number(tokenTotals?.totalCacheRead ?? 0);
  const totalCacheCreation = Number(tokenTotals?.totalCacheCreation ?? 0);

  // Calculate cost per conversation using calculateCost
  const perConvTokens = db
    .select({
      model: tokenUsage.model,
      inputTokens: sql<number>`sum(${tokenUsage.inputTokens})`,
      outputTokens: sql<number>`sum(${tokenUsage.outputTokens})`,
      cacheReadTokens: sql<number>`sum(${tokenUsage.cacheReadTokens})`,
      cacheCreationTokens: sql<number>`sum(${tokenUsage.cacheCreationTokens})`,
    })
    .from(tokenUsage)
    .innerJoin(conversations, sql`${tokenUsage.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .groupBy(tokenUsage.conversationId)
    .all();

  let estimatedCost = 0;
  let totalSavings = 0;
  for (const row of perConvTokens) {
    const costResult = calculateCost(
      row.model,
      Number(row.inputTokens),
      Number(row.outputTokens),
      Number(row.cacheReadTokens),
      Number(row.cacheCreationTokens),
    );
    if (costResult) {
      estimatedCost += costResult.cost;
      totalSavings += costResult.savings;
    }
  }

  return {
    totalInput,
    totalOutput,
    totalCacheRead,
    totalCacheCreation,
    estimatedCost,
    totalSavings,
    conversationCount: Number(convCount?.count ?? 0),
    activeDays: Number(activeDaysResult?.days ?? 0),
  };
}

/**
 * Get time-series data grouped by granularity.
 * Optional agent parameter filters results to a specific agent.
 */
export function getTimeSeries(from: string, to: string, granularity: Granularity, agent?: string): TimeSeriesPoint[] {
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
      period: sql<string>`strftime('${sql.raw(dateFormat)}', ${tokenUsage.createdAt})`.as('period'),
      model: tokenUsage.model,
      inputTokens: sql<number>`sum(${tokenUsage.inputTokens})`,
      outputTokens: sql<number>`sum(${tokenUsage.outputTokens})`,
      cacheReadTokens: sql<number>`sum(${tokenUsage.cacheReadTokens})`,
      cacheCreationTokens: sql<number>`sum(${tokenUsage.cacheCreationTokens})`,
      conversationCount: sql<number>`count(distinct ${tokenUsage.conversationId})`,
    })
    .from(tokenUsage)
    .innerJoin(conversations, sql`${tokenUsage.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .groupBy(sql`period`, tokenUsage.model)
    .orderBy(sql`period`)
    .all();

  // Aggregate per-model rows into per-period rows, summing costs
  const periodMap = new Map<string, TimeSeriesPoint>();

  for (const row of rows) {
    const period = row.period;
    const existing = periodMap.get(period);

    const input = Number(row.inputTokens);
    const output = Number(row.outputTokens);
    const cacheRead = Number(row.cacheReadTokens);
    const cacheCreation = Number(row.cacheCreationTokens);
    const convCount = Number(row.conversationCount);

    const costResult = calculateCost(row.model, input, output, cacheRead, cacheCreation);
    const cost = costResult?.cost ?? 0;

    if (existing) {
      existing.inputTokens += input;
      existing.outputTokens += output;
      existing.cacheReadTokens += cacheRead;
      existing.cacheCreationTokens += cacheCreation;
      existing.cost += cost;
      existing.conversationCount += convCount;
    } else {
      periodMap.set(period, {
        period,
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        cacheCreationTokens: cacheCreation,
        cost,
        conversationCount: convCount,
      });
    }
  }

  return Array.from(periodMap.values()).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Get model usage distribution: how many conversations use each model and total tokens per model.
 * Optional agent parameter filters results to a specific agent.
 */
export function getModelDistribution(from: string, to: string, agent?: string): Array<{ model: string; count: number; totalTokens: number }> {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));
  const dateFilter = and(...conditions);

  const totalTokensExpr = sql<number>`coalesce(sum(${tokenUsage.inputTokens}) + sum(${tokenUsage.outputTokens}) + sum(${tokenUsage.cacheReadTokens}) + sum(${tokenUsage.cacheCreationTokens}), 0)`;

  const rows = db
    .select({
      model: tokenUsage.model,
      count: sql<number>`count(distinct ${tokenUsage.conversationId})`,
      totalTokens: totalTokensExpr,
    })
    .from(tokenUsage)
    .innerJoin(conversations, sql`${tokenUsage.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .groupBy(tokenUsage.model)
    .orderBy(sql`${totalTokensExpr} DESC`)
    .all();

  return rows.map(r => ({
    model: r.model,
    count: Number(r.count),
    totalTokens: Number(r.totalTokens),
  }));
}

/**
 * Get paginated conversation list with token breakdown, cost, and optional filters.
 */
export function getConversationList(
  from: string,
  to: string,
  page: number = 1,
  limit: number = 20,
  sort: string = 'date',
  order: string = 'desc',
  agent?: string,
  project?: string,
  search?: string,
): ConversationListResponse {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];

  if (agent) conditions.push(eq(conversations.agent, agent));
  if (project) conditions.push(eq(conversations.project, project));

  // For search: query conversations where title/project/model match
  // OR where a message content matches
  if (search) {
    const searchPattern = `%${search}%`;
    const matchingConvIds = db
      .selectDistinct({ id: messages.conversationId })
      .from(messages)
      .where(like(messages.content, searchPattern));

    conditions.push(
      or(
        like(conversations.title, searchPattern),
        like(conversations.project, searchPattern),
        like(conversations.model, searchPattern),
        sql`${conversations.id} IN (${matchingConvIds})`
      )!
    );
  }

  const dateFilter = and(...conditions);

  const offset = (page - 1) * limit;

  // Sort column mapping
  const sortColumn = sort === 'inputTokens' ? sql`sum(${tokenUsage.inputTokens})`
    : sort === 'outputTokens' ? sql`sum(${tokenUsage.outputTokens})`
    : sort === 'cost' ? sql`sum(${tokenUsage.inputTokens})` // sort by input as proxy for cost
    : sql`${conversations.createdAt}`;

  const orderDir = order === 'asc' ? sql`ASC` : sql`DESC`;

  const rows = db
    .select({
      id: conversations.id,
      date: conversations.createdAt,
      agent: conversations.agent,
      title: conversations.title,
      project: conversations.project,
      model: conversations.model,
      inputTokens: sql<number>`coalesce(sum(${tokenUsage.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${tokenUsage.outputTokens}), 0)`,
      cacheReadTokens: sql<number>`coalesce(sum(${tokenUsage.cacheReadTokens}), 0)`,
      cacheCreationTokens: sql<number>`coalesce(sum(${tokenUsage.cacheCreationTokens}), 0)`,
    })
    .from(conversations)
    .leftJoin(tokenUsage, sql`${tokenUsage.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .groupBy(conversations.id)
    .orderBy(sql`${sortColumn} ${orderDir}`)
    .limit(limit)
    .offset(offset)
    .all();

  // Total count for pagination (with same filters)
  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(conversations)
    .where(dateFilter)
    .get();

  const conversationRows: ConversationRow[] = rows.map(row => {
    const model = row.model ?? 'unknown';
    const input = Number(row.inputTokens);
    const output = Number(row.outputTokens);
    const cacheRead = Number(row.cacheReadTokens);
    const cacheCreation = Number(row.cacheCreationTokens);

    const costResult = calculateCost(model, input, output, cacheRead, cacheCreation);

    const baseRow: ConversationRow = {
      id: row.id,
      date: row.date,
      agent: row.agent,
      title: row.title,
      project: row.project,
      model: row.model,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      cost: costResult?.cost ?? null,
      savings: costResult?.savings ?? null,
    };

    // If search was provided, extract a snippet from matching message content
    if (search) {
      const snippet = getSearchSnippet(row.id, search);
      return { ...baseRow, snippet };
    }

    return baseRow;
  });

  return {
    rows: conversationRows,
    total: Number(totalResult?.count ?? 0),
    page,
    limit,
  };
}

/**
 * Extract a text snippet from a conversation's messages matching the search term.
 */
function getSearchSnippet(conversationId: string, searchTerm: string): string | null {
  const matchingMsg = db
    .select({ content: messages.content })
    .from(messages)
    .where(and(
      eq(messages.conversationId, conversationId),
      like(messages.content, `%${searchTerm}%`)
    ))
    .limit(1)
    .get();

  if (!matchingMsg?.content) return null;

  return extractSnippet(matchingMsg.content, searchTerm);
}

/**
 * Extract snippet with context around the search term.
 */
function extractSnippet(content: string, searchTerm: string, contextChars: number = 100): string | null {
  const lowerContent = content.toLowerCase();
  const lowerTerm = searchTerm.toLowerCase();
  const idx = lowerContent.indexOf(lowerTerm);
  if (idx === -1) return null;

  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + searchTerm.length + contextChars);

  let snippet = '';
  if (start > 0) snippet += '...';
  snippet += content.slice(start, idx);
  snippet += `<mark>${content.slice(idx, idx + searchTerm.length)}</mark>`;
  snippet += content.slice(idx + searchTerm.length, end);
  if (end < content.length) snippet += '...';

  return snippet;
}

/**
 * Get full conversation detail: conversation metadata, messages, tool calls, and token summary.
 */
export function getConversationDetail(conversationId: string): ConversationDetailResponse | null {
  const conv = db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .get();

  if (!conv) return null;

  const msgs = db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
      model: messages.model,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .all();

  const tools = db
    .select({
      id: toolCalls.id,
      messageId: toolCalls.messageId,
      name: toolCalls.name,
      input: toolCalls.input,
      output: toolCalls.output,
      status: toolCalls.status,
      duration: toolCalls.duration,
      createdAt: toolCalls.createdAt,
    })
    .from(toolCalls)
    .where(eq(toolCalls.conversationId, conversationId))
    .orderBy(toolCalls.createdAt)
    .all();

  // Token summary grouped by model, then totaled
  const tokenRows = db
    .select({
      model: tokenUsage.model,
      inputTokens: sql<number>`sum(${tokenUsage.inputTokens})`,
      outputTokens: sql<number>`sum(${tokenUsage.outputTokens})`,
      cacheReadTokens: sql<number>`sum(${tokenUsage.cacheReadTokens})`,
      cacheCreationTokens: sql<number>`sum(${tokenUsage.cacheCreationTokens})`,
    })
    .from(tokenUsage)
    .where(eq(tokenUsage.conversationId, conversationId))
    .groupBy(tokenUsage.model)
    .all();

  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheCreation = 0;
  let totalCost = 0;
  let totalSavings = 0;
  let hasCost = false;

  for (const row of tokenRows) {
    const input = Number(row.inputTokens);
    const output = Number(row.outputTokens);
    const cacheRead = Number(row.cacheReadTokens);
    const cacheCreation = Number(row.cacheCreationTokens);

    totalInput += input;
    totalOutput += output;
    totalCacheRead += cacheRead;
    totalCacheCreation += cacheCreation;

    const costResult = calculateCost(row.model, input, output, cacheRead, cacheCreation);
    if (costResult) {
      hasCost = true;
      totalCost += costResult.cost;
      totalSavings += costResult.savings;
    }
  }

  return {
    conversation: {
      id: conv.id,
      agent: conv.agent,
      project: conv.project,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      model: conv.model,
    },
    messages: msgs,
    toolCalls: tools,
    tokenSummary: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadTokens: totalCacheRead,
      cacheCreationTokens: totalCacheCreation,
      cost: hasCost ? totalCost : null,
      savings: hasCost ? totalSavings : null,
    },
  };
}

/**
 * Get per-tool statistics: success/failure counts, frequency, avg and P95 duration.
 * Optional agent parameter filters by agent.
 */
export function getToolStats(from: string, to: string, agent?: string): ToolStatsRow[] {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));
  const dateFilter = and(...conditions);

  const rows = db
    .select({
      name: toolCalls.name,
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when ${toolCalls.status} = 'success' or ${toolCalls.status} = 'completed' then 1 else 0 end)`,
      failure: sql<number>`sum(case when ${toolCalls.status} is not null and ${toolCalls.status} != 'success' and ${toolCalls.status} != 'completed' then 1 else 0 end)`,
      avgDuration: sql<number>`avg(${toolCalls.duration})`,
    })
    .from(toolCalls)
    .innerJoin(conversations, sql`${toolCalls.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .groupBy(toolCalls.name)
    .orderBy(sql`count(*) DESC`)
    .all();

  // Compute P95 per tool via secondary query (SQLite has no PERCENTILE function)
  return rows.map(r => {
    const durations = db
      .select({ duration: toolCalls.duration })
      .from(toolCalls)
      .innerJoin(conversations, sql`${toolCalls.conversationId} = ${conversations.id}`)
      .where(and(dateFilter, eq(toolCalls.name, r.name), sql`${toolCalls.duration} is not null`))
      .orderBy(sql`${toolCalls.duration} ASC`)
      .all()
      .map(d => Number(d.duration));

    const p95 = durations.length > 0
      ? durations[Math.min(Math.floor(durations.length * 0.95), durations.length - 1)]
      : null;

    return {
      name: r.name,
      total: Number(r.total),
      success: Number(r.success),
      failure: Number(r.failure),
      avgDuration: r.avgDuration != null ? Math.round(Number(r.avgDuration)) : null,
      p95Duration: p95,
    };
  });
}

/**
 * Get daily conversation counts for activity heatmap.
 * Optional agent parameter filters by agent.
 */
export function getHeatmapData(from: string, to: string, agent?: string): HeatmapDay[] {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));

  const rows = db
    .select({
      date: sql<string>`date(${conversations.createdAt})`.as('date'),
      count: sql<number>`count(*)`,
    })
    .from(conversations)
    .where(and(...conditions))
    .groupBy(sql`date`)
    .orderBy(sql`date`)
    .all();

  return rows.map(r => ({ date: r.date, count: Number(r.count) }));
}

/**
 * Get per-project analytics: conversation count, token/cost breakdown, top models.
 * Optional agent parameter filters by agent.
 */
export function getProjectStats(from: string, to: string, agent?: string): ProjectStatsRow[] {
  const conditions = [
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z'),
  ];
  if (agent) conditions.push(eq(conversations.agent, agent));
  const dateFilter = and(...conditions);

  // Get per-project grouped data with token totals
  const rows = db
    .select({
      project: conversations.project,
      conversationCount: sql<number>`count(distinct ${conversations.id})`,
      lastActive: sql<string>`max(${conversations.createdAt})`,
      totalInput: sql<number>`coalesce(sum(${tokenUsage.inputTokens}), 0)`,
      totalOutput: sql<number>`coalesce(sum(${tokenUsage.outputTokens}), 0)`,
      totalCacheRead: sql<number>`coalesce(sum(${tokenUsage.cacheReadTokens}), 0)`,
      totalCacheCreation: sql<number>`coalesce(sum(${tokenUsage.cacheCreationTokens}), 0)`,
    })
    .from(conversations)
    .leftJoin(tokenUsage, sql`${tokenUsage.conversationId} = ${conversations.id}`)
    .where(dateFilter)
    .groupBy(conversations.project)
    .orderBy(sql`count(distinct ${conversations.id}) DESC`)
    .all();

  return rows.map(r => {
    const projectName = r.project ?? 'Unknown';
    const totalInput = Number(r.totalInput);
    const totalOutput = Number(r.totalOutput);
    const totalCacheRead = Number(r.totalCacheRead);
    const totalCacheCreation = Number(r.totalCacheCreation);

    // Calculate cost per model for this project using secondary query
    const projectConditions = [
      ...conditions.map(c => c), // re-create conditions
      eq(conversations.project, r.project!),
    ];
    const perModelTokens = db
      .select({
        model: tokenUsage.model,
        inputTokens: sql<number>`sum(${tokenUsage.inputTokens})`,
        outputTokens: sql<number>`sum(${tokenUsage.outputTokens})`,
        cacheReadTokens: sql<number>`sum(${tokenUsage.cacheReadTokens})`,
        cacheCreationTokens: sql<number>`sum(${tokenUsage.cacheCreationTokens})`,
      })
      .from(tokenUsage)
      .innerJoin(conversations, sql`${tokenUsage.conversationId} = ${conversations.id}`)
      .where(and(dateFilter, eq(conversations.project, r.project!)))
      .groupBy(tokenUsage.model)
      .all();

    let totalCost = 0;
    for (const mRow of perModelTokens) {
      const costResult = calculateCost(
        mRow.model,
        Number(mRow.inputTokens),
        Number(mRow.outputTokens),
        Number(mRow.cacheReadTokens),
        Number(mRow.cacheCreationTokens),
      );
      if (costResult) {
        totalCost += costResult.cost;
      }
    }

    // Get top models per project: distinct model names with conversation count
    const topModelsRows = db
      .select({
        model: tokenUsage.model,
        count: sql<number>`count(distinct ${tokenUsage.conversationId})`,
      })
      .from(tokenUsage)
      .innerJoin(conversations, sql`${tokenUsage.conversationId} = ${conversations.id}`)
      .where(and(dateFilter, eq(conversations.project, r.project!)))
      .groupBy(tokenUsage.model)
      .orderBy(sql`count(distinct ${tokenUsage.conversationId}) DESC`)
      .all();

    const topModels: ProjectModelEntry[] = topModelsRows.map(tm => ({
      model: tm.model,
      count: Number(tm.count),
    }));

    return {
      project: projectName,
      conversationCount: Number(r.conversationCount),
      lastActive: r.lastActive,
      totalTokens: totalInput + totalOutput + totalCacheRead + totalCacheCreation,
      totalCost,
      totalInput,
      totalOutput,
      totalCacheRead,
      totalCacheCreation,
      topModels,
    };
  });
}
