import { FastifyInstance } from 'fastify';
import { getOverviewStats, getTimeSeries, getConversationList } from '../db/queries/analytics.js';
import { autoGranularity } from '@cowboy/shared';
import type { Granularity } from '@cowboy/shared';

export default async function analyticsRoutes(app: FastifyInstance) {
  // GET /analytics/overview?from=&to=
  app.get('/analytics/overview', async (request) => {
    const { from, to } = request.query as { from?: string; to?: string };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return getOverviewStats(fromDate, toDate);
  });

  // GET /analytics/timeseries?from=&to=&granularity=
  app.get('/analytics/timeseries', async (request) => {
    const { from, to, granularity } = request.query as {
      from?: string;
      to?: string;
      granularity?: Granularity;
    };

    const toDate = to || new Date().toISOString().slice(0, 10);
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const gran = granularity || autoGranularity(fromDate, toDate);

    return getTimeSeries(fromDate, toDate, gran);
  });

  // GET /analytics/conversations?from=&to=&page=&limit=&sort=&order=
  app.get('/analytics/conversations', async (request) => {
    const { from, to, page, limit, sort, order } = request.query as {
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
      sort?: string;
      order?: string;
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
    );
  });
}
