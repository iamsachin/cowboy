import { FastifyInstance } from 'fastify';
import { getOverviewStats, getTimeSeries, getModelDistribution, getToolStats, getHeatmapData, getProjectStats, getConversationList, getConversationDetail } from '../db/queries/analytics.js';
import { autoGranularity } from '@cowboy/shared';
import type { Granularity } from '@cowboy/shared';

export default async function analyticsRoutes(app: FastifyInstance) {
  // GET /analytics/overview?from=&to=&agent=
  app.get('/analytics/overview', async (request) => {
    const { from, to, agent } = request.query as { from?: string; to?: string; agent?: string };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getOverviewStats(fromDate, toDate, agent || undefined);
  });

  // GET /analytics/timeseries?from=&to=&granularity=&agent=
  app.get('/analytics/timeseries', async (request) => {
    const { from, to, granularity, agent } = request.query as {
      from?: string;
      to?: string;
      granularity?: Granularity;
      agent?: string;
    };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const gran = granularity || autoGranularity(fromDate, toDate);

    return getTimeSeries(fromDate, toDate, gran, agent || undefined);
  });

  // GET /analytics/model-distribution?from=&to=&agent=
  app.get('/analytics/model-distribution', async (request) => {
    const { from, to, agent } = request.query as { from?: string; to?: string; agent?: string };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getModelDistribution(fromDate, toDate, agent || undefined);
  });

  // GET /analytics/tool-stats?from=&to=&agent=
  app.get('/analytics/tool-stats', async (request) => {
    const { from, to, agent } = request.query as { from?: string; to?: string; agent?: string };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getToolStats(fromDate, toDate, agent || undefined);
  });

  // GET /analytics/heatmap?from=&to=&agent=
  app.get('/analytics/heatmap', async (request) => {
    const { from, to, agent } = request.query as { from?: string; to?: string; agent?: string };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getHeatmapData(fromDate, toDate, agent || undefined);
  });

  // GET /analytics/project-stats?from=&to=&agent=
  app.get('/analytics/project-stats', async (request) => {
    const { from, to, agent } = request.query as { from?: string; to?: string; agent?: string };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getProjectStats(fromDate, toDate, agent || undefined);
  });

  // GET /analytics/conversations/:id -- must be registered BEFORE the list route
  app.get('/analytics/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const detail = getConversationDetail(id);
    if (!detail) {
      return reply.status(404).send({ error: 'Conversation not found' });
    }

    return detail;
  });

  // GET /analytics/conversations?from=&to=&page=&limit=&sort=&order=&agent=&project=&search=
  app.get('/analytics/conversations', async (request) => {
    const { from, to, page, limit, sort, order, agent, project, search } = request.query as {
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
      agent?: string;
      project?: string;
      search?: string;
    };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getConversationList(
      fromDate,
      toDate,
      Number(page) || 1,
      Number(limit) || 20,
      sort || 'date',
      order || 'desc',
      agent || undefined,
      project || undefined,
      search || undefined,
    );
  });
}
