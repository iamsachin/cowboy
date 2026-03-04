import { db } from '../index.js';
import { conversations, tokenUsage } from '../schema.js';
import { sql, and, gte, lte } from 'drizzle-orm';
import { calculateCost } from '@cowboy/shared';
import type { OverviewStats, TimeSeriesPoint, ConversationRow, ConversationListResponse } from '@cowboy/shared';
import type { Granularity } from '@cowboy/shared';

/**
 * Get overview stats for KPI cards: token totals, cost, conversation count, active days, trends.
 */
export function getOverviewStats(from: string, to: string): OverviewStats {
  const stats = computePeriodStats(from, to);

  // Compute prior period for trend calculation
  // Prior period ends the day before current 'from' to avoid overlap
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const periodMs = toDate.getTime() - fromDate.getTime();
  const priorToDate = new Date(fromDate.getTime() - 24 * 60 * 60 * 1000);
  const priorFromDate = new Date(priorToDate.getTime() - periodMs);
  const priorFrom = priorFromDate.toISOString().slice(0, 10);
  const priorTo = priorToDate.toISOString().slice(0, 10);

  const priorStats = computePeriodStats(priorFrom, priorTo);

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

function computePeriodStats(from: string, to: string): PeriodStats {
  const dateFilter = and(
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z')
  );

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
 */
export function getTimeSeries(from: string, to: string, granularity: Granularity): TimeSeriesPoint[] {
  const dateFormat = granularity === 'daily'
    ? '%Y-%m-%d'
    : granularity === 'weekly'
    ? '%Y-W%W'
    : '%Y-%m';

  const dateFilter = and(
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z')
  );

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
 * Get paginated conversation list with token breakdown and cost.
 */
export function getConversationList(
  from: string,
  to: string,
  page: number = 1,
  limit: number = 20,
  sort: string = 'date',
  order: string = 'desc',
): ConversationListResponse {
  const dateFilter = and(
    gte(conversations.createdAt, from),
    lte(conversations.createdAt, to + 'T23:59:59Z')
  );

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

  // Total count for pagination
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

    return {
      id: row.id,
      date: row.date,
      project: row.project,
      model: row.model,
      inputTokens: input,
      outputTokens: output,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
      cost: costResult?.cost ?? null,
      savings: costResult?.savings ?? null,
    };
  });

  return {
    rows: conversationRows,
    total: Number(totalResult?.count ?? 0),
    page,
    limit,
  };
}
