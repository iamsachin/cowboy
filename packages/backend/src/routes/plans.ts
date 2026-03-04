import { FastifyInstance } from 'fastify';
import { getPlanList, getPlanDetail, getPlanStats, getPlanTimeSeries, getPlansByConversation } from '../db/queries/plans.js';
import { autoGranularity } from '@cowboy/shared';
import type { Granularity } from '@cowboy/shared';

export default async function planRoutes(app: FastifyInstance) {
  // CRITICAL: Register specific routes BEFORE parameterized routes
  // to prevent Fastify treating "stats", "timeseries", "by-conversation" as :id parameters.

  // GET /plans/stats?from=&to=&agent=
  app.get('/plans/stats', async (request) => {
    const { from, to, agent } = request.query as { from?: string; to?: string; agent?: string };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getPlanStats(fromDate, toDate, agent || undefined);
  });

  // GET /plans/timeseries?from=&to=&granularity=&agent=
  app.get('/plans/timeseries', async (request) => {
    const { from, to, granularity, agent } = request.query as {
      from?: string;
      to?: string;
      granularity?: Granularity;
      agent?: string;
    };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const gran = granularity || autoGranularity(fromDate, toDate);

    return getPlanTimeSeries(fromDate, toDate, gran, agent || undefined);
  });

  // GET /plans/by-conversation/:conversationId
  app.get('/plans/by-conversation/:conversationId', async (request) => {
    const { conversationId } = request.params as { conversationId: string };
    return getPlansByConversation(conversationId);
  });

  // GET /plans/:id -- MUST be after specific routes to avoid parameter conflicts
  app.get('/plans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const detail = getPlanDetail(id);
    if (!detail) {
      return reply.status(404).send({ error: 'Plan not found' });
    }
    return detail;
  });

  // GET /plans?from=&to=&page=&limit=&sort=&order=&agent=&project=&status=
  app.get('/plans', async (request) => {
    const { from, to, page, limit, sort, order, agent, project, status } = request.query as {
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
      agent?: string;
      project?: string;
      status?: string;
    };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getPlanList(
      fromDate,
      toDate,
      Number(page) || 1,
      Number(limit) || 20,
      sort || 'date',
      order || 'desc',
      agent || undefined,
      project || undefined,
      status || undefined,
    );
  });
}
